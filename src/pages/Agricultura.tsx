import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type FiefView,
  type FiefsState,
  type LaborState,
  type CropOption,
} from "@/api/client";
import { QueryBoundary, GameIcon } from "@/components/ui";

/**
 * Agricultura feudal (Hito 5/6) para la app Capacitor.
 *
 * Dos bloques: los FEUDOS que la casa posee o administra (con sus acciones
 * agrícolas, reutilizando la misma lógica del motor feudal) y la MANO DE OBRA
 * (jornaleros NPC). Si además la casa es Señora de la provincia, aparece una
 * tarjeta para fijar el impuesto de cosecha (1..60 %) que se descuenta a los
 * administradores al recoger.
 */
export default function Agricultura() {
  const qc = useQueryClient();
  const fiefsQ = useQuery({ queryKey: ["fiefs"], queryFn: () => api.fiefs() });
  const laborQ = useQuery({ queryKey: ["labor"], queryFn: () => api.labor() });
  const cropsQ = useQuery({ queryKey: ["crops"], queryFn: () => api.crops(), staleTime: 300_000 });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["fiefs"] });
    qc.invalidateQueries({ queryKey: ["labor"] });
    qc.invalidateQueries({ queryKey: ["dynasty"] });
  };

  const fiefAct = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.fiefAction(body),
    onSuccess: invalidate,
  });
  const laborAct = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.laborAction(body),
    onSuccess: invalidate,
  });
  const taxAct = useMutation({
    mutationFn: (pct: number) => api.harvestTaxAction(pct),
    onSuccess: invalidate,
  });

  return (
    <div>
      {fiefsQ.data?.is_senor && (
        <TaxCard d={fiefsQ.data} onSave={(p) => taxAct.mutate(p)} busy={taxAct.isPending} msg={taxAct.data?.msg} ok={taxAct.data?.ok} />
      )}

      <section>
        <h2 style={{ margin: "4px 0 8px" }}>Feudos</h2>
        <QueryBoundary q={fiefsQ}>
          {(d) => <FiefList d={d} crops={cropsQ.data?.by_biome ?? {}} onAction={(b) => fiefAct.mutate(b)} busy={fiefAct.isPending} lastMsg={fiefAct.data?.msg} lastOk={fiefAct.data?.ok} />}
        </QueryBoundary>
      </section>

      <section>
        <h2 style={{ margin: "16px 0 8px" }}>Jornaleros</h2>
        <QueryBoundary q={laborQ}>
          {(d) => <LaborPanel d={d} onAction={(b) => laborAct.mutate(b)} busy={laborAct.isPending} msg={laborAct.data?.msg} ok={laborAct.data?.ok} />}
        </QueryBoundary>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tarjeta del señor: impuesto de cosecha
// ---------------------------------------------------------------------------
function TaxCard({
  d,
  onSave,
  busy,
  msg,
  ok,
}: {
  d: FiefsState;
  onSave: (pct: number) => void;
  busy: boolean;
  msg?: string;
  ok?: boolean;
}) {
  const [pct, setPct] = useState(String(d.harvest_tax_pct ?? 10));
  return (
    <div className="card">
      <h2>Impuesto de cosecha · {d.province}</h2>
      <p className="muted">
        Eres Señora de esta provincia. El porcentaje se descuenta automáticamente de la
        cosecha de quien la administra y va al cofre del dueño. (1 a 60 %)
      </p>
      <div className="field">
        <label htmlFor="tax">Porcentaje actual</label>
        <div className="inlineField">
          <input
            id="tax"
            inputMode="numeric"
            value={pct}
            onChange={(e) => setPct(e.target.value.replace(/[^0-9]/g, ""))}
          />
          <button
            className="btn"
            disabled={busy || !pct}
            onClick={() => onSave(Math.max(1, Math.min(60, Number(pct) || 1)))}
          >
            {busy ? "Guardando…" : "Fijar"}
          </button>
        </div>
      </div>
      {msg && <p className={ok ? "ok" : "error"}>{msg}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lista de feudos con sus acciones
// ---------------------------------------------------------------------------
function FiefList({
  d,
  crops,
  onAction,
  busy,
  lastMsg,
  lastOk,
}: {
  d: FiefsState;
  crops: Record<string, CropOption[]>;
  onAction: (body: Record<string, unknown>) => void;
  busy: boolean;
  lastMsg?: string;
  lastOk?: boolean;
}) {
  if (!d.house) {
    return <div className="state">No eres cabeza de casa; no puedes gestionar feudos.</div>;
  }
  if (d.fiefs.length === 0) {
    return (
      <div className="state">
        No tienes feudos propios ni administrados en {d.province}.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {d.fiefs.map((f) => (
        <FiefCard key={f.coords} f={f} crops={crops[f.biome] ?? []} onAction={onAction} busy={busy} />
      ))}
      {lastMsg && <p className={lastOk ? "ok" : "error"}>{lastMsg}</p>}
    </div>
  );
}

function FiefCard({
  f,
  crops,
  onAction,
  busy,
}: {
  f: FiefView;
  crops: CropOption[];
  onAction: (body: Record<string, unknown>) => void;
  busy: boolean;
}) {
  const [crop, setCrop] = useState(crops[0]?.id ?? "");
  const [ha, setHa] = useState("1");
  const [open, setOpen] = useState(false);

  const send = (extra: Record<string, unknown>) =>
    onAction({ action: "siembra", fief: f.coords, crop, ha: Number(ha) || 1, ...extra });

  return (
    <div className="card">
      <div className="row" style={{ alignItems: "center" }}>
        <strong>
          Feudo {f.coords} · {f.biome}
        </strong>
        <span className={`pill ${f.role === "admin" ? "mock" : "live"}`}>
          {f.role === "admin" ? "administrado" : "propio"}
        </span>
      </div>
      <div className="row">
        <span className="muted">Fertilidad / labrantío</span>
        <span>
          {Math.round(f.fertility)}% · {f.arable} ha
          {f.herd_ugm ? ` · UGM ${f.herd_ugm}` : ""}
        </span>
      </div>
      {f.role === "admin" && f.overlord && (
        <div className="row">
          <span className="muted">Señor (dueño)</span>
          <span>
            {f.overlord}
            {f.harvest_tax_pct != null ? ` · impuesto ${f.harvest_tax_pct}%` : ""}
          </span>
        </div>
      )}

      {f.crop ? (
        <div className="row">
          <span className="muted">
            <GameIcon id={f.crop.crop} category="crop" size={16} /> {f.crop.crop_name} ({f.crop.ha} ha)
          </span>
          <span className={f.crop.ready ? "ok" : ""}>
            {f.crop.ready ? "lista para cosechar" : `${f.crop.days_left} días`}
          </span>
        </div>
      ) : (
        <p className="muted">Sin cultivo plantado.</p>
      )}

      {f.stock.length > 0 && (
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          {f.stock.map((s) => (
            <span key={s.item} className="pill mock">
              <GameIcon id={s.item} size={14} /> {s.name} {s.amount}
            </span>
          ))}
        </div>
      )}

      {/* Siembra */}
      <div className="inlineField" style={{ marginTop: 8 }}>
        <select value={crop} onChange={(e) => setCrop(e.target.value)}>
          {crops.length === 0 && <option value="">(sin cultivos para este bioma)</option>}
          {crops.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.days ? ` · ${c.days}d` : ""}
            </option>
          ))}
        </select>
        <input
          inputMode="numeric"
          style={{ maxWidth: 70 }}
          value={ha}
          onChange={(e) => setHa(e.target.value.replace(/[^0-9]/g, ""))}
          aria-label="hectáreas"
        />
        <button className="btn" disabled={busy || !crop || !ha} onClick={() => send({})}>
          Sembrar
        </button>
      </div>

      <div className="actions">
        <button className="btn ghost" disabled={busy || !f.crop} onClick={() => onAction({ action: "cosecha", fief: f.coords })}>
          Cosechar
        </button>
        <button className="btn ghost" disabled={busy} onClick={() => onAction({ action: "compost", fief: f.coords, lotes: 1 })}>
          Compost
        </button>
        <button className="btn ghost" disabled={busy} onClick={() => setOpen((v) => !v)}>
          Más
        </button>
      </div>

      {open && (
        <div className="actions" style={{ marginTop: 6 }}>
          <button className="btn ghost" disabled={busy} onClick={() => onAction({ action: "abonar", fief: f.coords, cantidad: 1, material: "cal" })}>
            Abonar (cal)
          </button>
          <button className="btn ghost" disabled={busy} onClick={() => onAction({ action: "abonar", fief: f.coords, cantidad: 1, material: "compost" })}>
            Abonar (compost)
          </button>
          <button className="btn ghost" disabled={busy || !f.herd_ugm} onClick={() => onAction({ action: "pastar", fief: f.coords, ugm: f.herd_ugm })}>
            Pastar {f.herd_ugm} UGM
          </button>
          {(f.ha_forestable ?? 0) > 0 && (
            <button className="btn ghost" disabled={busy} title={`Vegetación ${Math.round(f.vegetation_pct ?? 0)}%`} onClick={() => onAction({ action: "deforestar", fief: f.coords })}>
              Talar (jornada)
            </button>
          )}
          {f.stock.map((s) => (
            <button key={s.item} className="btn ghost" disabled={busy || s.amount <= 0} onClick={() => onAction({ action: "transportar", fief: f.coords, recurso: s.item, cantidad: s.amount, destino: "casa" })}>
              Llevar {s.name} a casa
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mano de obra (jornaleros NPC)
// ---------------------------------------------------------------------------
function LaborPanel({
  d,
  onAction,
  busy,
  msg,
  ok,
}: {
  d: LaborState;
  onAction: (body: Record<string, unknown>) => void;
  busy: boolean;
  msg?: string;
  ok?: boolean;
}) {
  const [n, setN] = useState("1");
  const [pay, setPay] = useState(String(d.pay_min));
  return (
    <div className="card">
      <div className="row" style={{ alignItems: "center" }}>
        <strong>Jornaleros</strong>
        <span>
          {d.jornaleros} / {d.max}
        </span>
      </div>
      <div className="row">
        <span className="muted">Cereal en cofre / ración diaria</span>
        <span className={d.short_feed ? "error" : ""}>
          {d.cofre_cereal} / {d.daily_grain_need} kg
        </span>
      </div>
      <div className="row">
        <span className="muted">Paga anual</span>
        <span className={d.unpaid_this_year ? "error" : "ok"}>
          {d.last_pay_year == null ? "nunca" : `año ${d.last_pay_year}`}
          {d.unpaid_this_year ? " · pendiente este año" : ""}
        </span>
      </div>

      <div className="inlineField" style={{ marginTop: 8 }}>
        <input
          inputMode="numeric"
          style={{ maxWidth: 70 }}
          value={n}
          onChange={(e) => setN(e.target.value.replace(/[^0-9]/g, ""))}
          aria-label="cantidad"
        />
        <button className="btn" disabled={busy || !n} onClick={() => onAction({ action: "contratar", n: Number(n) || 1 })}>
          Contratar ({d.hire_cost} 🪙/c)
        </button>
        <button className="btn ghost" disabled={busy || !n} onClick={() => onAction({ action: "despedir", n: Number(n) || 1 })}>
          Despedir
        </button>
      </div>

      <div className="inlineField" style={{ marginTop: 8 }}>
        <input
          inputMode="numeric"
          style={{ maxWidth: 90 }}
          value={pay}
          onChange={(e) => setPay(e.target.value.replace(/[^0-9]/g, ""))}
          aria-label="paga por jornalero"
        />
        <button className="btn ghost" disabled={busy || !pay || d.jornaleros === 0} onClick={() => onAction({ action: "pagar", por: Number(pay) || d.pay_min })}>
          Pagar salario (mín {d.pay_min} 🪙)
        </button>
      </div>

      {d.short_feed && <p className="error">Falta cereal para alimentar a los jornaleros.</p>}
      {msg && <p className={ok ? "ok" : "error"}>{msg}</p>}
    </div>
  );
}
