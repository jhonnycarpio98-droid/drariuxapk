import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type MapRegionInfo, type MapState } from "@/api/client";
import { QueryBoundary } from "@/components/ui";

// ---------------------------------------------------------------------------
// Paleta y tablas (coherentes con world/map_data.py del motor)
// ---------------------------------------------------------------------------
// Símbolo de bioma -> nombre (el motor manda las filas con estos caracteres).
const SYMBOL_TO_BIOME: Record<string, string> = {
  "~": "oceano", T: "tundra", P: "pradera", D: "desierto", C: "montana",
  L: "llanura", F: "bosque", S: "jungla", I: "hielo",
};
const TERRAIN_COLORS: Record<string, string> = {
  pradera: "#6aa84f", llanura: "#8fae5d", bosque: "#2e7d32", tundra: "#9fb8ad",
  desierto: "#d9be6a", jungla: "#1f6b2a", pantano: "#5f705a", montana: "#8d8d8d",
  oceano: "#17466b", hielo: "#cfe8ef", unknown: "#444a52",
};
const TERRAIN_NAMES: Record<string, string> = {
  pradera: "Pradera", llanura: "Llanura", bosque: "Bosque", tundra: "Tundra",
  desierto: "Desierto", jungla: "Jungla", pantano: "Pantano", montana: "Montaña",
  oceano: "Océano", hielo: "Hielo", unknown: "Desconocido",
};
const ZONE_NAMES: Record<string, string> = {
  ecuatorial: "Ecuatorial", tropical: "Tropical", templado: "Templado", polar: "Polar",
};
const OCEAN = "oceano";
const ICE = "hielo";
const UNPLAYABLE = new Set([OCEAN, ICE]);

// Circunradio base de un hexágono (flat-top) en píxeles del mundo (escala 1).
const R = 18;
const SQRT3 = Math.sqrt(3);
// Límites de zoom: el suelo (MIN) evita que el jugador se pierda alejando
// hasta el mundo entero; el techo (MAX) evita pixeleo excesivo.
const MIN_SCALE = 0.35;
const MAX_SCALE = 4;
const DEFAULT_SCALE = 0.9; // apertura centrada en el jugador
// Vecinos en odd-q (columna impar desplazada a mitad de fila): mismos deltas
// que ``world_map._ODDQ_DIRS`` del motor.
const NEIGHBORS_EVEN = [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [0, 1]];
const NEIGHBORS_ODD = [[1, 1], [1, 0], [0, -1], [-1, 0], [-1, 1], [0, 1]];

function hexToPixel(q: number, r: number): [number, number] {
  return [1.5 * R * q, SQRT3 * R * (r + 0.5 * (q & 1))];
}

function pixelToHex(x: number, y: number): [number, number] {
  const q = Math.round(x / (1.5 * R));
  const r = Math.round(y / (SQRT3 * R) - 0.5 * (q & 1));
  // refina entre la casilla estimada y sus vecinos (bordes redondean mal)
  let best: [number, number] = [q, r];
  let bestD = Infinity;
  const table = (q & 1 ? NEIGHBORS_ODD : NEIGHBORS_EVEN).concat([[0, 0]]);
  for (const [dq, dr] of table) {
    const [cx, cy] = hexToPixel(q + dq, r + dr);
    const d = (cx - x) ** 2 + (cy - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = [q + dq, r + dr];
    }
  }
  return best;
}

function isAdjacent(a: [number, number], b: [number, number]): boolean {
  if (a[0] === b[0] && a[1] === b[1]) return true;
  const table = a[0] & 1 ? NEIGHBORS_ODD : NEIGHBORS_EVEN;
  return table.some(([dq, dr]) => a[0] + dq === b[0] && a[1] + dr === b[1]);
}

function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, rad: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i);
    const px = cx + rad * Math.cos(a);
    const py = cy + rad * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

interface Cell {
  q: number;
  r: number;
  biome: string;
  zone: string;
  isLand: boolean;
  oasis: boolean;
  region: MapRegionInfo | null;
}

export default function WorldMap() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["map"],
    queryFn: api.map,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [note, setNote] = useState<{ msg?: string; ok?: boolean }>({});

  const explore = useMutation({
    mutationFn: (qr: [number, number]) => api.mapExplore(qr[0], qr[1]),
    onSuccess: (res) => {
      setNote({ msg: res.msg, ok: res.ok });
      qc.invalidateQueries({ queryKey: ["map"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "No se pudo explorar.";
      setNote({ msg, ok: false });
    },
  });

  return (
    <QueryBoundary q={q}>
      {(d) => (
        <MapBoard
          d={d}
          selected={selected}
          onSelect={setSelected}
          exploring={explore.isPending}
          note={note}
          onExplore={(qr) => {
            setNote({});
            explore.mutate(qr);
          }}
        />
      )}
    </QueryBoundary>
  );
}

function MapBoard({
  d,
  selected,
  onSelect,
  exploring,
  note,
  onExplore,
}: {
  d: MapState;
  selected: [number, number] | null;
  onSelect: (qr: [number, number] | null) => void;
  exploring: boolean;
  note: { msg?: string; ok?: boolean };
  onExplore: (qr: [number, number]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState({ scale: DEFAULT_SCALE, tx: 0, ty: 0 });
  const [ready, setReady] = useState(false);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: number } | null>(null);

  // Índices rápidos a partir del payload.
  const { regionByKey, oasisSet, zoneByRow } = useMemo(() => {
    const rk = new Map<string, MapRegionInfo>();
    for (const reg of d.regions) rk.set(`${reg.q},${reg.r}`, reg);
    const os = new Set<string>();
    for (const [gx, gy] of d.oasis) os.add(`${gx},${gy}`);
    return { regionByKey: rk, oasisSet: os, zoneByRow: d.zones };
  }, [d]);

  const W = d.width;
  const H = d.height;

  // Tamaño del mundo en píxeles (escala 1), de centro a centro + un radio.
  const worldSize = useMemo(
    () => ({
      wW: 1.5 * R * (W - 1) + 2 * R,
      wH: SQRT3 * R * (H - 1 + 0.5) + 2 * R,
    }),
    [W, H],
  );

  // Recorta escala y paneo: el mundo nunca puede salirse del todo de la vista
  // (suelo de zoom + bordes), así el jugador no se "pierde" alejando.
  const clampView = useCallback(
    (v: { scale: number; tx: number; ty: number }) => {
      const canvas = canvasRef.current;
      const cssW = canvas?.clientWidth || 360;
      const cssH = canvas?.clientHeight || 480;
      const scale = clamp(v.scale, MIN_SCALE, MAX_SCALE);
      const cw = worldSize.wW * scale;
      const ch = worldSize.wH * scale;
      const tx = cw <= cssW ? (cssW - cw) / 2 : clamp(v.tx, cssW - cw, 0);
      const ty = ch <= cssH ? (cssH - ch) / 2 : clamp(v.ty, cssH - ch, 0);
      return { scale, tx, ty };
    },
    [worldSize],
  );

  const cellAt = useCallback(
    (q: number, r: number): Cell | null => {
      if (q < 0 || r < 0 || q >= W || r >= H) return null;
      const sym = d.rows[r]?.[q] ?? "~";
      const biome = SYMBOL_TO_BIOME[sym] ?? "unknown";
      return {
        q,
        r,
        biome,
        zone: zoneByRow[r] ?? "unknown",
        isLand: biome !== "unknown" && !UNPLAYABLE.has(biome),
        oasis: oasisSet.has(`${q},${r}`),
        region: regionByKey.get(`${q},${r}`) ?? null,
      };
    },
    [W, H, d.rows, zoneByRow, oasisSet, regionByKey],
  );

  // Ver todo el mundo respetando el suelo de zoom, centrado.
  const fitWorld = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cssW = canvas.clientWidth || 360;
    const cssH = canvas.clientHeight || 480;
    const scale = clamp(
      Math.min(cssW / worldSize.wW, cssH / worldSize.wH) * 0.98,
      MIN_SCALE,
      MAX_SCALE,
    );
    setView(
      clampView({
        scale,
        tx: (cssW - worldSize.wW * scale) / 2,
        ty: (cssH - worldSize.wH * scale) / 2,
      }),
    );
  }, [worldSize, clampView]);

  const centerOn = useCallback(
    (q: number, r: number, scale?: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const cssW = canvas.clientWidth || 360;
      const cssH = canvas.clientHeight || 480;
      const [wx, wy] = hexToPixel(q, r);
      const s = clamp(scale ?? view.scale, MIN_SCALE, MAX_SCALE);
      setView(clampView({ scale: s, tx: cssW / 2 - wx * s, ty: cssH / 2 - wy * s }));
    },
    [view.scale, clampView],
  );

  function doZoom(factor: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cssW = canvas.clientWidth || 360;
    const cssH = canvas.clientHeight || 480;
    setView((v) => {
      const ns = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
      const k = ns / v.scale;
      const mx = cssW / 2;
      const my = cssH / 2;
      return clampView({ scale: ns, tx: mx - (mx - v.tx) * k, ty: my - (my - v.ty) * k });
    });
  }

  useEffect(() => {
    if (!ready) {
      setReady(true);
      // Abrir centrado en el jugador (no en el mundo entero).
      if (d.player) centerOn(d.player[0], d.player[1], DEFAULT_SCALE);
      else fitWorld();
    }
  }, [ready, d.player, centerOn, fitWorld]);

  // Repintado.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cssW = canvas.clientWidth || 360;
    const cssH = canvas.clientHeight || 480;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = "#0b1220";
    ctx.fillRect(0, 0, cssW, cssH);

    const { scale, tx, ty } = view;
    const rad = R * scale;
    const tiny = rad < 2.6; // pinta cuadrados cuando el hex no se distingue

    for (let r = 0; r < H; r++) {
      const row = d.rows[r];
      if (!row) continue;
      for (let q = 0; q < W; q++) {
        const sym = row[q];
        const biome = SYMBOL_TO_BIOME[sym] ?? "unknown";
        const [wx, wy] = hexToPixel(q, r);
        const sx = wx * scale + tx;
        const sy = wy * scale + ty;
        if (sx < -rad || sy < -rad || sx > cssW + rad || sy > cssH + rad) continue;

        const water = biome === OCEAN;
        const iced = biome === ICE;
        const reg = regionByKey.get(`${q},${r}`);
        let color: string;
        if (water) color = "#12354f";
        else if (iced) color = "#8fb4bd";
        else if (reg?.explored) color = TERRAIN_COLORS[biome] ?? TERRAIN_COLORS.unknown;
        else if (reg) color = withAlpha(TERRAIN_COLORS[biome] ?? "#5a636e", 0.55); // caminada
        else color = withAlpha(TERRAIN_COLORS[biome] ?? "#4b5563", 0.22); // niebla con pista

        if (tiny) {
          ctx.fillStyle = color;
          ctx.fillRect(sx - rad, sy - rad * 0.85, rad * 2, rad * 1.7);
        } else {
          hexPath(ctx, sx, sy, rad);
          ctx.fillStyle = color;
          ctx.fill();
          if (!water) {
            ctx.lineWidth = 0.5;
            ctx.strokeStyle = "rgba(0,0,0,0.18)";
            ctx.stroke();
          }
        }

        // tinte de casa dominante en regiones exploradas
        if (reg?.explored && reg.house && !tiny) {
          hexPath(ctx, sx, sy, rad);
          ctx.fillStyle = withAlpha("#ffffff", 0.06);
          ctx.fill();
        }
        // núcleo poblado
        if (reg?.explored && reg.population > 0 && !tiny) {
          ctx.fillStyle = "#ece3d2";
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(1.5, rad * 0.22), 0, Math.PI * 2);
          ctx.fill();
        }
        // oasis
        if (reg ? false : oasisSet.has(`${q},${r}`) && biome !== OCEAN) {
          ctx.fillStyle = "#28b4a6";
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(1.2, rad * 0.28), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // marcador del jugador
    if (d.player) {
      const [wx, wy] = hexToPixel(d.player[0], d.player[1]);
      hexPath(ctx, wx * scale + tx, wy * scale + ty, rad);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "#ff5a5a";
      ctx.stroke();
    }
    // selección
    if (selected) {
      const [wx, wy] = hexToPixel(selected[0], selected[1]);
      hexPath(ctx, wx * scale + tx, wy * scale + ty, rad);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
    }
  }, [view, d, W, H, regionByKey, oasisSet, selected]);

  function screenToHex(clientX: number, clientY: number): [number, number] | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const [hx, hy] = pixelToHex((sx - view.tx) / view.scale, (sy - view.ty) / view.scale);
    if (hx < 0 || hy < 0 || hx >= W || hy >= H) return null;
    return [hx, hy];
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: 0 };
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const d0 = drag.current;
    if (!d0) return;
    const dx = e.clientX - d0.x;
    const dy = e.clientY - d0.y;
    d0.moved = Math.max(d0.moved, Math.abs(dx) + Math.abs(dy));
    setView((v) => clampView({ scale: v.scale, tx: d0.tx + dx, ty: d0.ty + dy }));
  }
  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const d0 = drag.current;
    drag.current = null;
    if (d0 && d0.moved < 6) {
      const hex = screenToHex(e.clientX, e.clientY);
      onSelect(hex);
    }
  }
  function onWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setView((v) => {
      const ns = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
      const k = ns / v.scale;
      return clampView({ scale: ns, tx: mx - (mx - v.tx) * k, ty: my - (my - v.ty) * k });
    });
  }

  const selCell = selected ? cellAt(selected[0], selected[1]) : null;
  const canExplore =
    !!selCell &&
    selCell.isLand &&
    !selCell.region?.explored &&
    !!d.player &&
    isAdjacent(d.player, [selCell.q, selCell.r]);

  return (
    <div>
      <div className="card" style={{ padding: 8 }}>
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => (drag.current = null)}
          onWheel={onWheel}
          style={{
            width: "100%",
            height: "58vh",
            display: "block",
            borderRadius: 10,
            touchAction: "none",
            cursor: "grab",
            background: "#0b1220",
          }}
        />
        <div className="actions" style={{ marginTop: 8, gap: 6, flexWrap: "wrap" }}>
          <button className="btn ghost" onClick={() => doZoom(1.3)}>
            + Zoom
          </button>
          <button className="btn ghost" onClick={() => doZoom(1 / 1.3)}>
            − Zoom
          </button>
          <button className="btn ghost" onClick={fitWorld}>
            Mundo
          </button>
          {d.player && (
            <button className="btn ghost" onClick={() => centerOn(d.player![0], d.player![1], 0.9)}>
              Mi posición
            </button>
          )}
        </div>
      </div>

      {selCell ? (
        <div className="card">
          <h2 style={{ textTransform: "capitalize" }}>
            {TERRAIN_NAMES[selCell.biome] ?? selCell.biome}
            {selCell.oasis ? " · oasis" : ""}
          </h2>
          <div className="row">
            <span className="muted">Coordenadas</span>
            <span className="mono">{selCell.q}, {selCell.r}</span>
          </div>
          <div className="row">
            <span className="muted">Clima</span>
            <span>{ZONE_NAMES[selCell.zone] ?? selCell.zone}</span>
          </div>
          <div className="row">
            <span className="muted">Terreno</span>
            <span>{selCell.isLand ? "tierra" : selCell.biome === OCEAN ? "océano" : "hielo"}</span>
          </div>
          <div className="row">
            <span className="muted">Estado</span>
            <span>
              {selCell.region?.explored
                ? "explorada"
                : selCell.region
                ? "caminada"
                : selCell.isLand
                ? "inexplorada"
                : "intransitable"}
            </span>
          </div>
          {selCell.region?.explored && (
            <>
              <div className="row">
                <span className="muted">Región</span>
                <span>{selCell.region.name}</span>
              </div>
              {selCell.region.house && (
                <div className="row">
                  <span className="muted">Casa dominante</span>
                  <span>{selCell.region.house}</span>
                </div>
              )}
              <div className="row">
                <span className="muted">Población</span>
                <span>{(selCell.region.population ?? 0).toLocaleString("es")}</span>
              </div>
            </>
          )}

          {!selCell.isLand && (
            <p className="muted" style={{ margin: "8px 0 0" }}>
              No se puede explorar ni pisar este terreno.
            </p>
          )}
          {selCell.isLand && selCell.region?.explored && (
            <p className="muted" style={{ margin: "8px 0 0" }}>
              Región ya explorada. Entra por el mapa a pie o desde su salida.
            </p>
          )}
          {canExplore && (
            <div className="actions" style={{ marginTop: 10 }}>
              <button
                className="btn"
                disabled={exploring}
                onClick={() => onExplore([selCell.q, selCell.r])}
              >
                {exploring ? "Explorando…" : "Explorar región"}
              </button>
            </div>
          )}
          {selCell.isLand && !selCell.region?.explored && !canExplore && (
            <p className="muted" style={{ margin: "8px 0 0" }}>
              Solo puedes explorar la región en la que estás o una vecina.
            </p>
          )}
          {note.msg && (
            <p className={note.ok ? "ok" : "error"} style={{ margin: "8px 0 0" }}>
              {note.msg}
            </p>
          )}
        </div>
      ) : (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Arrastra para moverte, rueda o botones para acercar. Toca un hex para
            verlo. Marca roja = tu posición.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// utilidades de color / zoom
// ---------------------------------------------------------------------------
function withAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
