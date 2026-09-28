import { useQuery } from "@tanstack/react-query";
import {
  api,
  type FiefsState,
  type FiefView,
  type HerdSpecies,
  type ExtractiveInfo,
} from "@/api/client";
import { QueryBoundary, GameIcon } from "@/components/ui";

/**
 * Ganadería y minería del feudo (plan §8 / §10).
 *
 * Página de sólo lectura que expone el sistema de cría ya residente en el motor
 * (individuos + cohortes reconciliados contra `fief.db.hato`) y los extractivos
 * (minas/tala/perlas) con su reserva restante y rendimiento a tope. Ambos viajan
 * en el payload de `/api/fiefs/` (`herd`, `extractive`, `mineral_reservas`).
 *
 * La compra/venta de animales y el pastoreo siguen viviendo en Agricultura y en
 * el mercado; aquí sólo se consulta la composición y la capacidad del hato.
 */
export default function Ganaderia() {
  const fiefsQ = useQuery({ queryKey: ["fiefs"], queryFn: () => api.fiefs() });

  return (
    <div>
      <section>
        <h2 style={{ margin: "4px 0 8px" }}>Hato y minas</h2>
        <p className="muted" style={{ margin: "0 0 10px" }}>
          Composición del ganado (sexos, crías, gestantes) y vetas activas por
          feudo. La cría, el pastoreo y la venta se gestionan en Agricultura.
        </p>
        <QueryBoundary q={fiefsQ}>
          {(d) => <FiefHerdList d={d} />}
        </QueryBoundary>
      </section>
    </div>
  );
}

function FiefHerdList({ d }: { d: FiefsState }) {
  if (!d.house) {
    return <div className="state">No eres cabeza de casa; no tienes hatos.</div>;
  }
  if (d.fiefs.length === 0) {
    return <div className="state">No tienes feudos en {d.province}.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {d.fiefs.map((f) => (
        <HerdCard key={f.coords} f={f} />
      ))}
    </div>
  );
}

function HerdCard({ f }: { f: FiefView }) {
  const herd = f.herd;
  const species = herd ? Object.values(herd.species).sort((a, b) => b.heads - a.heads) : [];
  const extractive = f.extractive ?? [];

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

      {/* Capacidad UGM del hato */}
      {herd && (
        <UgmBar ugm={herd.ugm} cap={herd.ugm_cap} heads={herd.heads_total} />
      )}

      {species.length === 0 ? (
        <p className="muted">Sin ganado en este feudo.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
          {species.map((sp) => (
            <SpeciesRow key={sp.species} sp={sp} />
          ))}
        </div>
      )}

      {/* Minas y extractivos */}
      {extractive.length > 0 && (
        <div style={{ borderTop: "1px solid var(--line)", marginTop: 10, paddingTop: 8 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
            Minas y extractivos (producción automática por cuadrilla)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {extractive.map((e) => (
              <ExtractiveRow key={e.type} e={e} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UgmBar({ ugm, cap, heads }: { ugm: number; cap: number; heads: number }) {
  const pct = cap > 0 ? Math.min(100, Math.round((ugm / cap) * 100)) : 0;
  const full = cap > 0 && ugm >= cap;
  return (
    <div style={{ marginTop: 6 }}>
      <div className="row" style={{ fontSize: 13 }}>
        <span className="muted">Capacidad del hato</span>
        <span>
          {ugm.toFixed(2)} / {cap} UGM · {heads} cabezas
        </span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 6,
          background: "var(--line)",
          overflow: "hidden",
          marginTop: 3,
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: full ? "var(--danger, #d64b4b)" : "var(--accent, #FF7A18)",
          }}
        />
      </div>
    </div>
  );
}

function SpeciesRow({ sp }: { sp: HerdSpecies }) {
  return (
    <div className="row" style={{ alignItems: "center", fontSize: 14 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 120 }}>
        <GameIcon id={sp.species} category="livestock" size={20} />
        {sp.name}
      </span>
      <span className="muted" style={{ flex: 1 }}>
        ♀ {sp.female} · ♂ {sp.male} · crías {sp.juveniles} · gest. {sp.gestantes}
      </span>
      <strong title="cabezas totales">{sp.heads}</strong>
      <span className="muted" style={{ marginLeft: 6, fontSize: 12 }} title="UGM por cabeza">
        {sp.ugm_each.toFixed(2)}/u
      </span>
    </div>
  );
}

function ExtractiveRow({ e }: { e: ExtractiveInfo }) {
  return (
    <div className="row" style={{ alignItems: "center", fontSize: 14 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 130 }}>
        <GameIcon id={e.type} category="building" size={18} />
        {e.name}
      </span>
      <span className="muted" style={{ flex: 1 }}>
        niv {e.level} · {e.resource} {e.per_day_full} kg/d (a tope)
      </span>
      {e.unlimited ? (
        <span className="pill live">inagotable</span>
      ) : (
        <span className="pill mock">{(e.reserve_remaining ?? 0).toLocaleString("es")} kg</span>
      )}
    </div>
  );
}
