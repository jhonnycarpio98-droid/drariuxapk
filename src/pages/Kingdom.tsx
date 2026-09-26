import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type KingdomState,
  type CommerceState,
  type CommerceRequest,
  type PopulationCensus,
} from "@/api/client";
import { QueryBoundary } from "@/components/ui";

const SUBS = ["Gestión", "Regencia", "Población", "Comercio", "Ejército"] as const;

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
      ) : sub === "Comercio" ? (
        <CommercePanel />
      ) : sub === "Población" ? (
        <PopulationPanel />
      ) : (
        <QueryBoundary q={q}>{(d) => <Section sub={sub} d={d} />}</QueryBoundary>
      )}
    </div>
  );
}

function Section({ sub, d }: { sub: (typeof SUBS)[number]; d: KingdomState }) {
  if (sub === "Gestión") return <Kv title="Gestión de la ciudadela" obj={d.management} />;
  if (sub === "Regencia") return <RegentPanel d={d} />;
  return null;
}

function RegentPanel({ d }: { d: KingdomState }) {
  const qc = useQueryClient();
  const r = (d.regent ?? {}) as Record<string, unknown>;
  const isRegent = Boolean(r.es_regente);
  const regencyEnabled = Boolean(r.regencia_enabled);
  const currentRegent = r.regent as { name?: string; kind?: string; house?: string } | null;
  const polity = (d.polity ?? {}) as Record<string, unknown>;
  const isKing = polity.title === "rey";
  const regionsGoverned = Number(polity.regions_governed ?? 0);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["kingdom"] });

  const collect = useMutation({
    mutationFn: () => api.kingdomAction({ action: "collect" }),
    onSuccess: invalidate,
  });
  const found = useMutation({
    mutationFn: () => api.kingdomAction({ action: "found_kingdom" }),
    onSuccess: invalidate,
  });
  const setRegent = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.kingdomAction(body),
    onSuccess: invalidate,
  });

  return (
    <div>
      {!isKing && (
        <div className="card">
          <h2>Reino</h2>
          <p className="muted">
            Gobiernas {regionsGoverned} región(es). Fundar un reino cuesta 100 monedas
            y exige gobernar al menos 2 regiones.
          </p>
          <div className="actions">
            <button
              className="btn"
              disabled={regionsGoverned < 2 || found.isPending}
              onClick={() => found.mutate()}
            >
              {found.isPending ? "Fundando…" : "Fundar reino (100 🪙)"}
            </button>
          </div>
          {found.data && <p className={found.data.ok ? "ok" : "error"}>{found.data.msg}</p>}
        </div>
      )}

      <div className="card">
        <h2>Regencia</h2>
        {isRegent ? (
          <>
            <p className="muted">Gobiernas esta provincia como regente.</p>
            <div className="actions">
              <button className="btn" disabled={collect.isPending} onClick={() => collect.mutate()}>
                {collect.isPending ? "Recaudando…" : "Recaudar impuesto (drariux)"}
              </button>
            </div>
            {collect.data && <p className={collect.data.ok ? "" : "error"}>{collect.data.msg}</p>}
          </>
        ) : (
          <p className="muted">No eres el regente de esta provincia.</p>
        )}

        {regencyEnabled && (
          <div style={{ marginTop: 12 }}>
            <p className="muted">
              <strong>Regente delegado:</strong>{" "}
              {currentRegent
                ? `${currentRegent.name} (${currentRegent.kind === "family" ? "familia" : "amigo"})`
                : "ninguno (gobernas en persona)."}
            </p>
            <div className="actions">
              <button
                className="btn ghost"
                disabled={setRegent.isPending}
                onClick={() => {
                  const t = window.prompt("Casa o jugador amigo (regente):");
                  if (t) setRegent.mutate({ action: "assign_regent", kind: "friend", target: t });
                }}
              >
                Nombrar amigo
              </button>
              <button
                className="btn ghost"
                disabled={setRegent.isPending}
                onClick={() => {
                  const m = window.prompt("Id de miembro de tu familia (o 'head'):");
                  if (m) setRegent.mutate({ action: "assign_regent", kind: "family", member: m });
                }}
              >
                Nombrar familiar
              </button>
              {currentRegent && (
                <button
                  className="btn ghost"
                  disabled={setRegent.isPending}
                  onClick={() => setRegent.mutate({ action: "revoke_regent" })}
                >
                  Revocar
                </button>
              )}
            </div>
            {setRegent.data && (
              <p className={setRegent.data.ok ? "ok" : "error"}>{setRegent.data.msg}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PopulationPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["population"], queryFn: () => api.population() });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["population"] });
    qc.invalidateQueries({ queryKey: ["kingdom"] });
  };
  const act = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.populationAction(body),
    onSuccess: invalidate,
  });

  return (
    <QueryBoundary q={q}>
      {(d: PopulationCensus) => {
        const t = d.totals ?? {};
        return (
          <div>
            <div className="card">
              <h2>Censo de la Casa {d.house ?? "—"}</h2>
              <p className="muted">
                {d.title_label ?? "Sin título"} · {d.regions_governed} región(es)
              </p>
              <div className="grid">
                <div className="stat">
                  <div className="k">Población</div>
                  <div className="v">{t.total ?? 0}</div>
                </div>
                <div className="stat">
                  <div className="k">Libres</div>
                  <div className="v">{t.libre ?? 0}</div>
                </div>
                <div className="stat">
                  <div className="k">Siervos</div>
                  <div className="v">{t.siervos ?? 0}</div>
                </div>
                <div className="stat">
                  <div className="k">Reclutas</div>
                  <div className="v">{t.reclutas ?? 0}</div>
                </div>
                <div className="stat">
                  <div className="k">Hambrunas</div>
                  <div className="v">{t.hambrunas ?? 0}</div>
                </div>
                <div className="stat">
                  <div className="k">Rebeliones</div>
                  <div className="v">{t.rebeliones ?? 0}</div>
                </div>
              </div>
              <p className="muted small">
                Necesidad anual: {t.necesidad_anual_kg_grano ?? 0} kg grano ·{" "}
                {t.necesidad_anual_kg_proteina ?? 0} kg proteína (250 + 100 kg/persona).
              </p>
              {act.data && (
                <p className={act.data.ok ? "ok" : "error"}>
                  {act.data.msg ?? String(act.data.error ?? "")}
                </p>
              )}
            </div>

            {d.provinces.length === 0 ? (
              <div className="card">
                <p className="muted">No gobiernas provincias con población todavía.</p>
              </div>
            ) : (
              d.provinces.map((p) => (
                <div className="card" key={p.dbref}>
                  <h2>
                    {p.provincia}{" "}
                    <span className="muted">
                      · {p.biome}
                      {p.agua ? ` (${p.agua})` : ""}
                    </span>
                  </h2>
                  <div className="row">
                    <span className="muted">Total {p.total}</span>
                    <span className="muted">
                      libres {p.libre} · siervos {p.siervos} · reclutas {p.reclutas} · ciudadela{" "}
                      {p.ciudadela}
                    </span>
                  </div>
                  <div className="row">
                    <span className="muted">
                      Alfolí {p.grano_disponible}/{p.grano_necesario} (cov {p.cobertura}) · estab.{" "}
                      {p.estabilidad}
                    </span>
                    <span>
                      {p.rebeldia ? (
                        <span className="pill horse">rebelión</span>
                      ) : p.hambruna ? (
                        <span className="pill">hambruna</span>
                      ) : (
                        <span className="ok">abastecida</span>
                      )}
                    </span>
                  </div>
                  <div className="actions">
                    <button
                      className="btn"
                      disabled={act.isPending || p.libre <= 0}
                      onClick={() => act.mutate({ action: "recruit", province: p.dbref })}
                    >
                      Reclutar
                    </button>
                    <button
                      className="btn ghost"
                      disabled={act.isPending || p.libre <= 0}
                      onClick={() => act.mutate({ action: "enserf", province: p.dbref })}
                    >
                      Hacer siervos
                    </button>
                    <button
                      className="btn ghost"
                      disabled={act.isPending || (p.siervos + p.reclutas) <= 0}
                      onClick={() =>
                        act.mutate({ action: "free", province: p.dbref, n: p.siervos || 1 })
                      }
                    >
                      Liberar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        );
      }}
    </QueryBoundary>
  );
}

function CommercePanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["commerce"], queryFn: () => api.commerce() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["commerce"] });
  const act = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.commerceAction(body),
    onSuccess: invalidate,
  });

  return (
    <QueryBoundary q={q}>
      {(d) => (
        <div>
          {act.data && (
            <p className={act.data.ok ? "" : "error"}>
              {act.data.msg ?? (act.data.error ? String(act.data.error) : "")}
            </p>
          )}
          <CofreCard d={d} act={act} />
          <RequestsCard
            title="Solicitudes recibidas (tú vendes)"
            reqs={d.incoming}
            empty="Nadie te ha pedido nada."
            actions={(r) =>
              r.status === "pendiente" ? (
                <>
                  <button className="btn" onClick={() => act.mutate({ action: "accept", id: r.id })}>
                    Aceptar
                  </button>
                  <button
                    className="btn ghost"
                    onClick={() => {
                      const p = window.prompt("Nuevo precio por unidad:");
                      if (p) act.mutate({ action: "counter", id: r.id, price: Number(p) });
                    }}
                  >
                    Contraofertar
                  </button>
                  <button className="btn ghost" onClick={() => act.mutate({ action: "reject", id: r.id })}>
                    Rechazar
                  </button>
                </>
              ) : (
                <span className="muted">en espera del comprador</span>
              )
            }
          />
          <RequestsCard
            title="Solicitudes enviadas (tú compras)"
            reqs={d.outgoing}
            empty="No has enviado solicitudes."
            actions={(r) =>
              r.status === "contraoferta" ? (
                <button className="btn" onClick={() => act.mutate({ action: "accept", id: r.id })}>
                  Aceptar contraoferta
                </button>
              ) : (
                <button className="btn ghost" onClick={() => act.mutate({ action: "cancel", id: r.id })}>
                  Cancelar
                </button>
              )
            }
          />
          <CatalogCard d={d} act={act} />
        </div>
      )}
    </QueryBoundary>
  );
}

function CofreCard({
  d,
  act,
}: {
  d: CommerceState;
  act: { mutate: (b: Record<string, unknown>) => void; isPending: boolean };
}) {
  return (
    <div className="card">
      <h2>Tu cofre · precios de venta</h2>
      {d.cofre.length === 0 ? (
        <p className="muted">Tu cofre está vacío. Nada que vender todavía.</p>
      ) : (
        d.cofre.map((c) => (
          <div className="row" key={c.item}>
            <span>
              {c.nombre} <span className="muted">×{c.qty}</span>
            </span>
            <span>
              {c.for_sale ? (
                <span className="pill">{d.prices[c.item]} 🪙/ud</span>
              ) : (
                <span className="muted">no a la venta</span>
              )}
              <button
                className="btn ghost"
                style={{ marginLeft: 8 }}
                onClick={() => {
                  const p = window.prompt(
                    `Precio por unidad de ${c.nombre} (0 = dejar de vender):`,
                    c.for_sale ? String(d.prices[c.item] ?? "") : "",
                  );
                  if (p !== null) act.mutate({ action: "set_price", item: c.item, price: Number(p) });
                }}
              >
                Fijar precio
              </button>
            </span>
          </div>
        ))
      )}
    </div>
  );
}

function RequestsCard({
  title,
  reqs,
  empty,
  actions,
}: {
  title: string;
  reqs: CommerceRequest[];
  empty: string;
  actions: (r: CommerceRequest) => React.ReactNode;
}) {
  return (
    <div className="card">
      <h2>{title}</h2>
      {reqs.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        reqs.map((r) => (
          <div className="row" key={r.id}>
            <div>
              {r.buyer_house} → {r.seller_house}
              <span className="muted">
                {" "}
                · {r.qty} {r.item} @ {r.price} 🪙 [{r.status}]
              </span>
            </div>
            <span className="actions">{actions(r)}</span>
          </div>
        ))
      )}
    </div>
  );
}

function CatalogCard({
  d,
  act,
}: {
  d: CommerceState;
  act: { mutate: (b: Record<string, unknown>) => void; isPending: boolean };
}) {
  return (
    <div className="card">
      <h2>Anuncio de casas (comprar)</h2>
      {d.catalog.length === 0 ? (
        <p className="muted">Nadie tiene nada a la venta.</p>
      ) : (
        d.catalog.map((row) => (
          <div className="row" key={`${row.seller_account}-${row.item}`}>
            <div>
              <span className="pill">{row.house}</span>{" "}
              {row.nombre} <span className="muted">· {row.available} disp.</span>{" "}
              <span className="muted">@ {row.price} 🪙</span>
            </div>
            <button
              className="btn"
              disabled={act.isPending}
              onClick={() => {
                const qty = window.prompt(`¿Cuántas unidades de ${row.nombre}?`, "1");
                if (qty)
                  act.mutate({
                    action: "send_request",
                    seller: row.seller_account,
                    item: row.item,
                    qty: Number(qty),
                  });
              }}
            >
              Pedir
            </button>
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
