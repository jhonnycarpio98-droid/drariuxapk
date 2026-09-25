import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type KingdomState } from "@/api/client";
import { QueryBoundary } from "@/components/ui";

const SUBS = ["Gestión", "Regencia", "Almacén", "Mercado", "Ejército"] as const;

export default function Kingdom() {
  const [sub, setSub] = useState<(typeof SUBS)[number]>("Gestión");
  const q = useQuery({ queryKey: ["kingdom"], queryFn: () => api.kingdom() });

  return (
    <div>
      <div className="subtabs">
        {SUBS.map((s) => (
          <button
            key={s}
            className={s === sub ? "active" : ""}
            onClick={() => setSub(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {sub === "Ejército" ? (
        <ArmyPanel />
      ) : (
        <QueryBoundary q={q}>{(d) => <Section sub={sub} d={d} />}</QueryBoundary>
      )}
    </div>
  );
}

function Section({ sub, d }: { sub: (typeof SUBS)[number]; d: KingdomState }) {
  if (sub === "Gestión")
    return <Kv title="Gestión de la ciudadela" obj={d.management} />;
  if (sub === "Regencia")
    return <RegentPanel d={d} />;
  if (sub === "Almacén")
    return <Kv title="Almacén provincial" obj={d.warehouse ?? {}} empty="No tienes almacén en esta provincia." />;
  if (sub === "Mercado") return <MarketPanel d={d} />;
  return null;
}

function RegentPanel({ d }: { d: KingdomState }) {
  const qc = useQueryClient();
  const isRegent = Boolean((d.regent as Record<string, unknown>).es_regente);
  const collect = useMutation({
    mutationFn: () => api.kingdomAction({ action: "collect" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kingdom"] }),
  });
  return (
    <div className="card">
      <h2>Regencia</h2>
      {isRegent ? (
        <>
          <p className="muted">Gobiernas esta provincia como regente.</p>
          <div className="actions">
            <button
              className="btn"
              disabled={collect.isPending}
              onClick={() => collect.mutate()}
            >
              {collect.isPending ? "Recaudando…" : "Recaudar impuesto (drariux)"}
            </button>
          </div>
          {collect.data && <p className={collect.data.ok ? "" : "error"}>{collect.data.msg}</p>}
        </>
      ) : (
        <p className="muted">No eres el regente de esta provincia.</p>
      )}
    </div>
  );
}

function MarketPanel({ d }: { d: KingdomState }) {
  const offers = d.market.offers ?? [];
  return (
    <div className="card">
      <h2>Mercado de intercambio</h2>
      {offers.length === 0 ? (
        <p className="muted">Sin ofertas. Publica desde la consola del motor (se requiere almacén).</p>
      ) : (
        offers.map((o, i) => (
          <div className="row" key={i}>
            <span>{String((o as Record<string, unknown>).id ?? i)}</span>
            <span className="muted">
              {JSON.stringify((o as Record<string, unknown>).give)} ⇄{" "}
              {JSON.stringify((o as Record<string, unknown>).want)}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

function Kv({
  title,
  obj,
  empty,
}: {
  title: string;
  obj: Record<string, unknown>;
  empty?: string;
}) {
  const entries = Object.entries(obj ?? {});
  return (
    <div className="card">
      <h2>{title}</h2>
      {entries.length === 0 ? (
        <p className="muted">{empty ?? "Sin datos."}</p>
      ) : (
        entries.map(([k, v]) => (
          <div className="row" key={k}>
            <span className="muted">{k}</span>
            <span>{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
          </div>
        ))
      )}
    </div>
  );
}

function ArmyPanel() {
  const q = useQuery({ queryKey: ["army"], queryFn: () => api.army() });
  return (
    <QueryBoundary q={q}>
      {(d) => {
        if (!d.camp)
          return (
            <div className="card">
              <h2>Ejército</h2>
              <p className="muted">
                Sin campamento en esta provincia. Plántalo desde la consola del
                motor: <span className="mono">campamento &lt;fx,fy&gt;</span>.
              </p>
            </div>
          );
        const c = d.camp;
        return (
          <div>
            <div className="card">
              <h2>{c.key}</h2>
              <div className="grid">
                <div className="stat">
                  <div className="k">Soldados</div>
                  <div className="v">{c.count}</div>
                </div>
                <div className="stat">
                  <div className="k">Poder</div>
                  <div className="v">{c.power}</div>
                </div>
                <div className="stat">
                  <div className="k">Comandante</div>
                  <div className="v">Nv {c.commander_level}</div>
                </div>
              </div>
            </div>
            <div className="card">
              <h2>Tropa</h2>
              {c.soldiers.map((s) => (
                <div className="row" key={s.id}>
                  <div>
                    #{s.id} {s.esp_nombre}{" "}
                    {s.montado && <span className="pill horse">jinete</span>}
                  </div>
                  <span className="muted">
                    moral {s.moral} · salud {s.salud} · energía {s.energia}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      }}
    </QueryBoundary>
  );
}
