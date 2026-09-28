import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type BuildingCatalogEntry,
  type BuildingFief,
  type BuildingsState,
  type TreasuryGood,
} from "@/api/client";
import { QueryBoundary, GameIcon } from "@/components/ui";

/**
 * Producción / edificios (t11). Se levanta sobre la misma lógica feudal viva:
 * construir o mejorar un edificio en un feudo propio (paga madera/piedra/cal/
 * hierro del cofre), asignar la cuadrilla de la granja y elegir qué salida de un
 * taller prioriza el motor semi-automático (t13).
 */
export default function Produccion() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["buildings"], queryFn: () => api.buildings() });
  const act = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.buildingAction(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["buildings"] });
      qc.invalidateQueries({ queryKey: ["fiefs"] });
      qc.invalidateQueries({ queryKey: ["dynasty"] });
      qc.invalidateQueries({ queryKey: ["commerce"] });
    },
  });

  return (
    <div>
      {act.data?.msg && (
        <p className={act.data.ok ? "ok" : "error"} style={{ margin: "0 0 8px" }}>
          {act.data.msg}
        </p>
      )}
      <QueryBoundary q={q}>
        {(d) => <ProductionPanel d={d} act={act} />}
      </QueryBoundary>
    </div>
  );
}

const COST_KEYS = ["madera", "piedra", "cal", "hierro"] as const;

// ---------------------------------------------------------------------------
// Panel raíz: cofre + feudos
// ---------------------------------------------------------------------------
function ProductionPanel({
  d,
  act,
}: {
  d: BuildingsState;
  act: { isPending: boolean; mutate: (body: Record<string, unknown>) => void; data?: unknown };
}) {
  const catalog = useMemo(() => {
    const m: Record<string, BuildingCatalogEntry> = {};
    for (const c of d.catalog) m[c.type] = c;
    return m;
  }, [d.catalog]);

  if (!d.house) {
    return <div className="state">No eres cabeza de casa; no puedes construir.</div>;
  }

  return (
    <div>
      <CofreBar goods={d.cofre.goods} />
      {d.fiefs.length === 0 ? (
        <div className="state">No tienes feudos propios en {d.province} donde construir.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {d.fiefs.map((f) => (
            <FiefBuildCard
              key={f.coords}
              f={f}
              catalog={catalog}
              all={d.catalog}
              cofreGoods={d.cofre.goods}
              act={act}
            />
          ))}
        </div>
      )}

      <section>
        <h2 style={{ margin: "16px 0 8px" }}>Cadena textil</h2>
        <TextileChain goods={d.cofre.goods} />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barra con los recursos del cofre que cuestan los edificios
// ---------------------------------------------------------------------------
function CofreBar({ goods }: { goods: TreasuryGood[] }) {
  const byItem: Record<string, number> = {};
  for (const g of goods) byItem[g.item] = g.amount;
  return (
    <div className="card">
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        <strong>Cofre</strong>
        {COST_KEYS.map((k) => (
          <span key={k} className="pill mock">
            <GameIcon id={k} size={14} /> {k} {byItem[k] ?? 0}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cadena textil: fibra -> hilo (hiladero) -> tela (tejedero) -> ropa (sastreria).
// Muestra el saldo del cofre por etapa (t12: reubicada desde Agricultura).
// ---------------------------------------------------------------------------
function TextileChain({ goods }: { goods: TreasuryGood[] }) {
  const named = (pred: (item: string) => boolean) =>
    goods.filter((g) => pred(g.item) && g.amount > 0);
  const qtyOf = (pred: (item: string) => boolean) =>
    goods.filter((g) => pred(g.item)).reduce((s, g) => s + g.amount, 0);

  const stages: {
    n: number;
    label: string;
    place: string;
    match: (item: string) => boolean;
  }[] = [
    { n: 1, label: "Fibra", place: "campo / esquila", match: (i) => i.startsWith("fibra_") },
    { n: 2, label: "Hilo", place: "Hiladero (rueca)", match: (i) => i.startsWith("hilo_") },
    { n: 3, label: "Tela", place: "Tejedero (telar)", match: (i) => i.startsWith("tela_") },
    { n: 4, label: "Ropa", place: "Sastreria (aguja)", match: (i) => i.startsWith("ropa_") || i === "capa" },
  ];

  return (
    <div className="card">
      <p className="muted" style={{ margin: "0 0 8px" }}>
        La madera de tus bosques paga telares y ruecas: cada eslabon necesita
        herramientas y obreros. Se muestra el saldo del cofre por etapa.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {stages.map((s) => {
          const items = named(s.match);
          const total = qtyOf(s.match);
          return (
            <div key={s.n} className="row" style={{ alignItems: "center" }}>
              <span className="pill">
                {s.n} · {s.label}
              </span>
              <span className="muted" style={{ flex: 1 }}>
                {s.place}
                {items.length > 0
                  ? ` — ${items.map((it) => `${it.name} ${it.amount}`).join(", ")}`
                  : " — sin existencias"}
              </span>
              <strong>{total}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tarjeta de un feudo: edificios en pie, mejorar, elegir salida, asignar
// trabajadores y construir uno nuevo.
// ---------------------------------------------------------------------------
function FiefBuildCard({
  f,
  catalog,
  all,
  cofreGoods,
  act,
}: {
  f: BuildingFief;
  catalog: Record<string, BuildingCatalogEntry>;
  all: BuildingCatalogEntry[];
  cofreGoods: TreasuryGood[];
  act: { isPending: boolean; mutate: (body: Record<string, unknown>) => void };
}) {
  const byItem: Record<string, number> = {};
  for (const g of cofreGoods) byItem[g.item] = g.amount;
  const built = f.buildings.map((b) => b.type);
  const disponibles = all.filter((c) => !built.includes(c.type));
  const [nuevo, setNuevo] = useState("");

  return (
    <div className="card">
      <div className="row" style={{ alignItems: "center" }}>
        <strong>Feudo {f.coords} · {f.biome}</strong>
        {f.is_capital && <span className="pill live">capital</span>}
      </div>

      {f.buildings.length === 0 && (
        <p className="muted">Sin edificios en pie todavía.</p>
      )}

      {/* Edificios construidos: mejorar / elegir salida / cuadrilla granja */}
      {f.buildings.map((b) => {
        const spec = catalog[b.type];
        const maxLv = spec?.max_level ?? b.level;
        const outs = spec?.outputs ?? [];
        const chosen = f.receta[b.type];
        return (
          <div key={b.type} style={{ borderTop: "1px solid var(--line)", marginTop: 8, paddingTop: 8 }}>
            <div className="row" style={{ alignItems: "center" }}>
              <span>
                <GameIcon id={b.type} category="building" size={16} /> {b.name}
              </span>
              <span className="muted">
                nivel {b.level} / {maxLv}
              </span>
            </div>

            {b.level < maxLv && (
              <button
                className="btn ghost"
                disabled={act.isPending}
                onClick={() => act.mutate({ action: "improve", fief: f.coords, building: b.type })}
              >
                Mejorar nivel
              </button>
            )}

            {b.type === "granja" && (
              <FarmWorkers fief={f.coords} workers={f.workers} act={act} />
            )}

            {outs.length > 1 && (
              <OutputPicker
                building={b.type}
                buildingName={b.name}
                outputs={outs}
                chosen={chosen ?? []}
                act={act}
                fief={f.coords}
              />
            )}
          </div>
        );
      })}

      {/* Construir edificio nuevo */}
      <div style={{ borderTop: "1px solid var(--line)", marginTop: 10, paddingTop: 8 }}>
        <div className="inlineField">
          <select value={nuevo} onChange={(e) => setNuevo(e.target.value)} aria-label="edificio">
            <option value="">Construir un edificio…</option>
            {disponibles.map((c) => (
              <option key={c.type} value={c.type}>
                {c.name}
                {c.citadel_only && !f.is_capital ? " (solo capital)" : ""}
              </option>
            ))}
          </select>
          <button
            className="btn"
            disabled={act.isPending || !nuevo}
            onClick={() => act.mutate({ action: "build", fief: f.coords, building: nuevo })}
          >
            Construir
          </button>
        </div>
        {nuevo && catalog[nuevo] && (
          <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {catalog[nuevo].cost.map((amt, i) => {
              if (!amt) return null;
              const key = COST_KEYS[i];
              const falta = (byItem[key] ?? 0) < amt;
              return (
                <span key={key} className={`pill ${falta ? "error" : "mock"}`}>
                  {key} {amt}
                </span>
              );
            })}
            {catalog[nuevo].requires && (
              <span className="muted" style={{ width: "100%", fontSize: 12 }}>
                Requiere: {catalog[nuevo].requires}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cuadrilla de la granja (jornaleros asignados a este feudo)
// ---------------------------------------------------------------------------
function FarmWorkers({
  fief,
  workers,
  act,
}: {
  fief: string;
  workers: number;
  act: { isPending: boolean; mutate: (body: Record<string, unknown>) => void };
}) {
  const [n, setN] = useState(String(workers));
  return (
    <div className="inlineField" style={{ marginTop: 6 }}>
      <span className="muted">Cuadrilla</span>
      <input
        inputMode="numeric"
        style={{ maxWidth: 70 }}
        value={n}
        onChange={(e) => setN(e.target.value.replace(/[^0-9]/g, ""))}
        aria-label="trabajadores"
      />
      <button
        className="btn ghost"
        disabled={act.isPending}
        onClick={() => act.mutate({ action: "assign", fief, n: Number(n) || 0 })}
      >
        Fijar ({workers} asignados)
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Selector de salida: tilda las elaboraciones que el taller debe priorizar.
// Vacio = deja correr todas (motor por defecto).
// ---------------------------------------------------------------------------
function OutputPicker({
  building,
  buildingName,
  outputs,
  chosen,
  act,
  fief,
}: {
  building: string;
  buildingName: string;
  outputs: BuildingCatalogEntry["outputs"];
  chosen: string[];
  act: { isPending: boolean; mutate: (body: Record<string, unknown>) => void };
  fief: string;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set(chosen));
  const toggle = (item: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  return (
    <div style={{ marginTop: 6 }}>
      <p className="muted" style={{ margin: "0 0 4px", fontSize: 12 }}>
        {buildingName}: elige qué producir (sin marcar = todo lo que pueda).
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {outputs.map((o) => {
          const on = sel.has(o.item);
          return (
            <button
              key={o.item}
              type="button"
              className={`pill ${on ? "live" : "mock"}`}
              onClick={() => toggle(o.item)}
            >
              <GameIcon id={o.item} size={14} /> {o.name}
            </button>
          );
        })}
      </div>
      <button
        className="btn ghost"
        style={{ marginTop: 6 }}
        disabled={act.isPending}
        onClick={() => act.mutate({ action: "set_output", fief, building, outputs: [...sel] })}
      >
        Guardar selección
      </button>
    </div>
  );
}
