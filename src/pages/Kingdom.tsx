import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type KingdomState,
  type CommerceState,
  type CommerceRequest,
  type CommerceListing,
  type PopulationCensus,
  type PopulationProvince,
  type DiplomacyState,
  type VassalRow,
  type DiploState,
} from "@/api/client";
import { QueryBoundary, GameIcon } from "@/components/ui";
import { HouseLink } from "@/components/HouseProfile";

const SUBS = [
  "Gestión",
  "Regencia",
  "Población",
  "Comercio",
  "Ejército",
  "Diplomacia",
  "Vasallos",
  "Políticas",
] as const;

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
      ) : sub === "Diplomacia" ? (
        <DiplomacyPanel />
      ) : sub === "Vasallos" ? (
        <VassalsPanel />
      ) : sub === "Políticas" ? (
        <PoliciesPanel />
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

const DIPLO_LABEL: Record<DiploState, string> = {
  war: "⚔ En guerra",
  peace: "🕊 En paz",
  alliance: "🤝 Aliados",
  vassalage_offer: "👑 Oferta de vasallaje",
  trade_agreement: "⚖ Tratado comercial",
  unknown: "— Sin relaciones",
};

const DIPLO_PILL: Record<DiploState, string> = {
  war: "pill horse",
  peace: "pill",
  alliance: "pill",
  vassalage_offer: "pill",
  trade_agreement: "pill",
  unknown: "pill",
};

function DiplomacyPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["diplomacy"], queryFn: () => api.diplomacy() });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["diplomacy"] });
    qc.invalidateQueries({ queryKey: ["kingdom"] });
  };
  const act = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.diplomacyAction(body),
    onSuccess: invalidate,
  });

  return (
    <QueryBoundary q={q}>
      {(d: DiplomacyState) => (
        <div>
          <div className="card">
            <h2>{d.kingdom.key}</h2>
            <p className="muted">
              Casa reinante {d.kingdom.house}. Las decisiones del rey alcanzan a sus
              vasallos salvo que los eximas (pestaña Vasallos).
            </p>
            {act.data && (
              <p className={act.data.ok ? "ok" : "error"}>
                {act.data.msg ?? String(act.data.error ?? "")}
              </p>
            )}
          </div>

          {d.states.length === 0 ? (
            <div className="card">
              <p className="muted">
                No hay otros reinos conocidos. Siembra un rival con{" "}
                <code>scripts/seed_king.py</code>.
              </p>
            </div>
          ) : (
            d.states.map((row) => (
              <div className="card" key={row.dbref}>
                <h2>
                  {row.kingdom}{" "}
                  <span className={DIPLO_PILL[row.state] ?? "pill"}>
                    {DIPLO_LABEL[row.state] ?? row.state}
                  </span>
                </h2>
                {row.they_offer && (
                  <p className="muted">
                    Recibiste una <strong>oferta de {row.they_offer}</strong> de {row.house}.
                  </p>
                )}
                <div className="actions">
                  {row.state !== "war" && (
                    <button
                      className="btn"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ action: "declare_war", target: row.dbref })}
                    >
                      Declarar guerra
                    </button>
                  )}
                  {row.state === "war" && (
                    <button
                      className="btn ghost"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ action: "propose_peace", target: row.dbref })}
                    >
                      Pedir paz
                    </button>
                  )}
                  {row.they_offer === "peace" && (
                    <button
                      className="btn"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ action: "accept_peace", target: row.dbref })}
                    >
                      Aceptar paz
                    </button>
                  )}
                  {row.state !== "alliance" && row.state !== "war" && (
                    <button
                      className="btn ghost"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ action: "propose_alliance", target: row.dbref })}
                    >
                      Ofrecer alianza
                    </button>
                  )}
                  {row.they_offer === "alliance" && (
                    <button
                      className="btn"
                      disabled={act.isPending}
                      onClick={() =>
                        act.mutate({ action: "accept_alliance", target: row.dbref })
                      }
                    >
                      Aceptar alianza
                    </button>
                  )}
                  {row.state === "alliance" && (
                    <button
                      className="btn ghost"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ action: "break_alliance", target: row.dbref })}
                    >
                      Romper alianza
                    </button>
                  )}
                  {row.state !== "alliance" &&
                    row.state !== "trade_agreement" &&
                    row.state !== "war" && (
                      <button
                        className="btn ghost"
                        disabled={act.isPending}
                        onClick={() => act.mutate({ action: "propose_trade", target: row.dbref })}
                      >
                        Ofrecer tratado comercial
                      </button>
                    )}
                  {row.they_offer === "trade_agreement" && (
                    <button
                      className="btn"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ action: "accept_trade", target: row.dbref })}
                    >
                      Aceptar tratado comercial
                    </button>
                  )}
                  {row.state === "trade_agreement" && (
                    <button
                      className="btn ghost"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ action: "break_trade", target: row.dbref })}
                    >
                      Romper tratado comercial
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </QueryBoundary>
  );
}

function VassalsPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["diplomacy"], queryFn: () => api.diplomacy() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["diplomacy"] });
  const act = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.diplomacyAction(body),
    onSuccess: invalidate,
  });

  return (
    <QueryBoundary q={q}>
      {(d: DiplomacyState) => {
        const enemies = d.states.filter((s) => s.state === "war");
        const vassals = d.vassals.filter((v) => !v.is_rey);
        return (
          <div>
            <div className="card">
              <h2>Vasallos de {d.kingdom.key}</h2>
              <p className="muted">
                Cada vasallo secundará las guerras del rey salvo que lo eximas frente a un
                reino enemigo concreto.
              </p>
              {act.data && (
                <p className={act.data.ok ? "ok" : "error"}>
                  {act.data.msg ?? String(act.data.error ?? "")}
                </p>
              )}
            </div>
            {vassals.length === 0 ? (
              <div className="card">
                <p className="muted">No tienes casas vasallas. Usa {"'reino/…'"} o el invitado de vasallaje.</p>
              </div>
            ) : (
              vassals.map((v: VassalRow) => (
                <div className="card" key={v.province_dbref + v.house}>
                  <h2>
                    {v.house}{" "}
                    <span className="muted">
                      · {v.province}
                      {v.region ? ` (${v.region})` : ""}
                    </span>
                  </h2>
                  <p className="muted">
                    En guerra contra: {v.at_war_with.length ? v.at_war_with.join(", ") : "ninguno"}
                  </p>
                  {enemies.length === 0 ? (
                    <p className="muted small">No hay guerras activas que conceder.</p>
                  ) : (
                    <div className="actions">
                      {enemies.map((e) => {
                        const exempt = Boolean(v.exempt[e.house]);
                        return (
                          <button
                            key={e.dbref}
                            className={exempt ? "btn ghost" : "btn"}
                            disabled={act.isPending}
                            onClick={() =>
                              act.mutate({
                                action: exempt ? "revoke_exemption" : "exempt",
                                target: e.dbref,
                                vassal: v.house,
                              })
                            }
                          >
                            {exempt ? `Revocar exención (${e.house})` : `Eximir de guerra (${e.house})`}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        );
      }}
    </QueryBoundary>
  );
}

function PoliciesPanel() {
  const qc = useQueryClient();
  const pop = useQuery({ queryKey: ["population"], queryFn: () => api.population() });
  const [pct, setPct] = useState<number>(10);
  const act = useMutation({
    mutationFn: (body: { pct: number; province?: string }) =>
      api.harvestTaxAction(body.pct, body.province),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kingdom"] });
      qc.invalidateQueries({ queryKey: ["population"] });
    },
  });

  return (
    <QueryBoundary q={pop}>
      {(d: PopulationCensus) => (
        <div>
          <div className="card">
            <h2>Políticas del reino</h2>
            <p className="muted">
              El rey fija el impuesto de la cosecha por provincia (1–60 %). La corvea
              militar y la producción dirigida se delegan a los gobernadores.
            </p>
            <div className="row">
              <label className="muted">
                Impuesto de cosecha:{" "}
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={pct}
                  onChange={(e) => setPct(Number(e.target.value))}
                  style={{ width: 64 }}
                />{" "}
                %
              </label>
            </div>
            {act.data && (
              <p className={act.data.ok ? "ok" : "error"}>
                {act.data.msg ?? String(act.data.error ?? "")}
              </p>
            )}
          </div>

          {d.provinces.map((p) => (
            <div className="card" key={p.dbref}>
              <h2>
                <GameIcon id={p.biome} category="biomes" />
                {p.provincia} <span className="muted">· {p.total} hab.</span>
              </h2>
              <div className="actions">
                <button
                  className="btn"
                  disabled={act.isPending}
                  onClick={() => act.mutate({ pct, province: p.dbref })}
                >
                  Fijar {pct}% en esta provincia
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </QueryBoundary>
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
                <ProvinceRow key={p.dbref} p={p} act={act} />
              ))
            )}
          </div>
        );
      }}
    </QueryBoundary>
  );
}

function ProvinceRow({
  p,
  act,
}: {
  p: PopulationProvince;
  act: {
    isPending: boolean;
    mutate: (body: Record<string, unknown>) => void;
  };
}) {
  const [n, setN] = useState<string>("");
  const num = n.trim() === "" ? undefined : Math.max(0, parseInt(n, 10) || 0);
  const busy = act.isPending || p.libre <= 0;
  const cost = (num ?? 0) * 1; // 1 drariux por siervo (SERF_COST_DRX)
  return (
    <div className="card">
      <h2>
        <GameIcon id={p.biome} category="biomes" />
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
      <div className="row">
        <label className="muted" htmlFor={`qty-${p.dbref}`}>
          Cantidad
        </label>
        <input
          id={`qty-${p.dbref}`}
          type="number"
          min={0}
          max={p.libre}
          inputMode="numeric"
          placeholder={`máx ${p.libre}`}
          value={n}
          onChange={(e) => setN(e.target.value)}
          style={{ width: 120 }}
        />
      </div>
      {num !== undefined && num > 0 && (
        <p className="muted small">
          Hacer siervos cuesta {cost} drariux ({num} × 1) y quedan disponibles
          como jornaleros: recruta soldados con ellos en el Ejército (requiere
          campamento).
        </p>
      )}
      <div className="actions">
        <button
          className="btn"
          disabled={busy}
          onClick={() =>
            act.mutate({ action: "enserf", province: p.dbref, ...(num != null ? { n: num } : {}) })
          }
        >
          Hacer siervos
        </button>
        <button
          className="btn ghost"
          disabled={act.isPending || (p.siervos + p.reclutas) <= 0}
          onClick={() =>
            act.mutate({
              action: "free",
              province: p.dbref,
              n: num ?? (p.siervos || 1),
            })
          }
        >
          Liberar
        </button>
      </div>
    </div>
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
                  <CounterButton id={r.id} act={act} />
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
          <CaravansCard caravans={d.caravans} />
          <CatalogCard d={d} act={act} />
        </div>
      )}
    </QueryBoundary>
  );
}

// t17: pedidos en ruta (caravanas) con su ETA
function CaravansCard({ caravans }: { caravans: CommerceState["caravans"] }) {
  const list = caravans ?? [];
  return (
    <div className="card">
      <h2>Pedidos en ruta · caravanas</h2>
      {list.length === 0 ? (
        <p className="muted">No hay cargamentos viajando ahora mismo.</p>
      ) : (
        list.map((c) => (
          <div key={c.id} className="row" style={{ justifyContent: "space-between" }}>
            <span>
              {c.as === "comprador" ? "↓ " : "↑ "}
              <strong>{c.qty}</strong> {c.nombre}
              <span className="muted">
                {" · "}
                {c.seller_house} → {c.buyer_house} · {c.cost} DRX
              </span>
            </span>
            <span className="pill">
              {c.local
                ? "local"
                : c.days_left > 0
                  ? `${c.days_left} d · día ${c.arrive_day}`
                  : "llegando"}
              {c.carts ? ` · ${c.carts} carreta${c.carts === 1 ? "" : "s"}` : ""}
            </span>
          </div>
        ))
      )}
    </div>
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
          <CofreRow key={c.item} c={c} price={d.prices[c.item]} act={act} />
        ))
      )}
    </div>
  );
}

function CofreRow({
  c,
  price,
  act,
}: {
  c: CommerceState["cofre"][number];
  price?: number;
  act: { mutate: (b: Record<string, unknown>) => void; isPending: boolean };
}) {
  const [p, setP] = useState(c.for_sale ? String(price ?? "") : "");
  return (
    <div className="row" style={{ flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      <span style={{ flex: 1, minWidth: 140 }}>
        <GameIcon id={c.item} />
        {c.nombre} <span className="muted">×{c.qty}</span>
        {c.for_sale ? (
          <span className="pill" style={{ marginLeft: 6 }}>{price} 🪙/ud</span>
        ) : (
          <span className="muted" style={{ marginLeft: 6 }}>no a la venta</span>
        )}
      </span>
      <div className="inlineField">
        <input
          inputMode="decimal"
          style={{ maxWidth: 90 }}
          placeholder="precio"
          value={p}
          onChange={(e) => setP(e.target.value.replace(/[^0-9.]/g, ""))}
          aria-label={`precio de ${c.nombre}`}
        />
        <button
          className="btn ghost"
          disabled={act.isPending}
          onClick={() => act.mutate({ action: "set_price", item: c.item, price: Number(p) || 0 })}
        >
          {p && Number(p) > 0 ? "Vender" : "Quitar"}
        </button>
      </div>
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
              <GameIcon id={r.item} />
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

function CounterButton({
  id,
  act,
}: {
  id: string;
  act: { mutate: (b: Record<string, unknown>) => void; isPending: boolean };
}) {
  const [open, setOpen] = useState(false);
  const [p, setP] = useState("");
  if (!open) {
    return (
      <button className="btn ghost" onClick={() => setOpen(true)}>
        Contraofertar
      </button>
    );
  }
  return (
    <span className="inlineField">
      <input
        inputMode="decimal"
        style={{ maxWidth: 80 }}
        placeholder="nuevo"
        value={p}
        onChange={(e) => setP(e.target.value.replace(/[^0-9.]/g, ""))}
        aria-label="contraoferta"
      />
      <button
        className="btn"
        disabled={act.isPending || !p}
        onClick={() => act.mutate({ action: "counter", id, price: Number(p) })}
      >
        Ok
      </button>
      <button className="btn ghost" onClick={() => setOpen(false)}>
        X
      </button>
    </span>
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
          <CatalogRow key={`${row.seller_account}-${row.item}`} row={row} act={act} />
        ))
      )}
    </div>
  );
}

function CatalogRow({
  row,
  act,
}: {
  row: CommerceListing;
  act: { mutate: (b: Record<string, unknown>) => void; isPending: boolean };
}) {
  const [qty, setQty] = useState("1");
  const blocked = row.tradeable === false;
  return (
    <div className="row" style={{ flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      <div style={{ flex: 1, minWidth: 160 }}>
        <HouseLink accountId={row.seller_account} label={row.house} />{" "}
        <GameIcon id={row.item} />
        {row.nombre} <span className="muted">· {row.available} disp.</span>{" "}
        <span className="muted">@ {row.price} 🪙</span>
      </div>
      {blocked ? (
        <span className="pill mock" title="Sin acuerdo comercial ni alianza: proponlo en Reino > Diplomacia">
          sin acuerdo
        </span>
      ) : (
        <div className="inlineField">
          <input
            inputMode="numeric"
            style={{ maxWidth: 70 }}
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ""))}
            aria-label="cantidad"
          />
          <button
            className="btn"
            disabled={act.isPending || !qty}
            onClick={() =>
              act.mutate({
                action: "send_request",
                seller: row.seller_account,
                item: row.item,
                qty: Number(qty),
              })
            }
          >
            Pedir
          </button>
        </div>
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
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["army"], queryFn: () => api.army() });
  const [esp, setEsp] = useState("espadachin");
  const [qty, setQty] = useState("1");
  const [pay, setPay] = useState("1");
  const [ropa, setRopa] = useState("1");
  const [battle, setBattle] = useState<import("@/api/client").BattleResult | null>(null);
  const [targets, setTargets] = useState<import("@/api/client").CampView[] | null>(null);
  const [moveDest, setMoveDest] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const act = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.armyAction(body),
    onSuccess: (r) => {
      setMsg(r.msg ?? null);
      if (r.result) setBattle(r.result);
      if (r.targets) setTargets(r.targets);
      qc.invalidateQueries({ queryKey: ["army"] });
    },
    onError: (e) => setMsg(e instanceof Error ? e.message : "Error en la acción"),
  });
  const busy = act.isPending;

  return (
    <QueryBoundary q={q}>
      {(d) => {
        if (!d.house)
          return <div className="state">No eres cabeza de casa; no puedes levantar ejército.</div>;

        if (!d.camp)
          return (
            <div className="card">
              <h2>Ejército · {d.province}</h2>
              <p className="muted">
                Sin campamento en esta provincia. Plantarlo sobre uno de tus
                feudos propios; el comandante será la cabeza de tu casa.
              </p>
              <CampPlantForm provinceDbref={d.province_dbref} act={act} />
              {msg && <p className="error">{msg}</p>}
            </div>
          );

        const c = d.camp;
        const lg = c.logistics;
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
                {(c.prisoners ?? 0) > 0 && (
                  <div className="stat">
                    <div className="k">Prisioneros</div>
                    <div className="v">{c.prisoners}</div>
                  </div>
                )}
              </div>
              {(c.prisoners ?? 0) > 0 && (
                <div className="actions" style={{ marginTop: 8 }}>
                  <button
                    className="btn ghost"
                    disabled={busy}
                    onClick={() => act.mutate({ action: "prisioneros" })}
                  >
                    Convertir prisioneros en siervos
                  </button>
                </div>
              )}
            </div>

            {lg && (
              <div className="card">
                <h2>Logística</h2>
                <div className="row">
                  <span className="muted">Armas en el cofre</span>
                  <span>
                    {Object.entries(lg.weapons)
                      .map(([k, v]) => `${k} ${v}`)
                      .join(" · ") || "—"}
                    {lg.arrows > 0 ? ` · flechas ${lg.arrows}` : ""}
                  </span>
                </div>
                <div className="row">
                  <span className="muted">Ropa vestible (ciclo {c.ropa_ciclo ?? 0} entregadas)</span>
                  <span>{lg.clothing}</span>
                </div>
                <div className="row">
                  <span className="muted">
                    Forraje · {lg.mounted} jinetes · need {lg.need_forage_day}/día
                  </span>
                  <span className={lg.forage < lg.need_forage_day ? "error" : "ok"}>
                    {lg.forage}
                  </span>
                </div>
                <div className="row">
                  <span className="muted">Grano · need {lg.need_grain_day}/día</span>
                  <span className={lg.grain < lg.need_grain_day ? "error" : "ok"}>{lg.grain}</span>
                </div>
              </div>
            )}

            <div className="card">
              <h2>Acciones</h2>
              <div className="inlineField">
                <select value={esp} onChange={(e) => setEsp(e.target.value)}>
                  <option value="espadachin">Espadachín</option>
                  <option value="arquero">Arquero</option>
                  <option value="lancero">Lancero</option>
                </select>
                <input
                  inputMode="numeric"
                  style={{ maxWidth: 70 }}
                  value={qty}
                  onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ""))}
                  aria-label="cantidad"
                />
                <button
                  className="btn"
                  disabled={busy || !qty}
                  onClick={() => act.mutate({ action: "recruit", esp, qty: Number(qty) || 1 })}
                >
                  Reclutar
                </button>
              </div>

              <div className="inlineField" style={{ marginTop: 8 }}>
                <input
                  inputMode="numeric"
                  style={{ maxWidth: 90 }}
                  value={pay}
                  onChange={(e) => setPay(e.target.value.replace(/[^0-9]/g, ""))}
                  aria-label="paga por soldado"
                />
                <button
                  className="btn ghost"
                  disabled={busy || !pay}
                  onClick={() => act.mutate({ action: "pay", per_soldier: Number(pay) || 1 })}
                >
                  Pagar anual (🪙/soldado)
                </button>
              </div>

              <div className="inlineField" style={{ marginTop: 8 }}>
                <input
                  inputMode="numeric"
                  style={{ maxWidth: 90 }}
                  value={ropa}
                  onChange={(e) => setRopa(e.target.value.replace(/[^0-9]/g, ""))}
                  aria-label="prendas a entregar"
                />
                <button
                  className="btn ghost"
                  disabled={busy || !ropa}
                  onClick={() => act.mutate({ action: "vestir", n: Number(ropa) || 1 })}
                >
                  Vestir (prendas del cofre)
                </button>
              </div>

              <div className="actions" style={{ marginTop: 8 }}>
                <button
                  className="btn"
                  disabled={busy || c.count === 0}
                  onClick={() => {
                    setBattle(null);
                    setTargets(null);
                    act.mutate({ action: "attack" });
                  }}
                >
                  Atacar enemigo
                </button>
              </div>

              {msg && !battle && <p className={battle ? "ok" : "error"}>{msg}</p>}

              {targets && targets.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <p className="muted">Varios campamentos enemigos; elige objetivo:</p>
                  {targets.map((t) => (
                    <div className="row" key={t.dbref}>
                      <span>{t.key} · {t.count} sold · poder {t.power}</span>
                      <button
                        className="btn ghost"
                        disabled={busy}
                        onClick={() => {
                          setTargets(null);
                          act.mutate({ action: "attack", target: t.dbref });
                        }}
                      >
                        Atacar
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {battle && (
                <div className="card" style={{ marginTop: 8 }}>
                  <h2>Resultado de la batalla</h2>
                  <p className={battle.winner === c.dbref ? "ok" : "error"}>
                    {battle.note ??
                      (battle.winner === c.dbref
                        ? "¡Victoria!"
                        : "Derrota.")}
                  </p>
                  {!battle.note && (
                    <>
                      <div className="row">
                        <span className="muted">Fuerza propia / enemiga</span>
                        <span>{battle.power_a} vs {battle.power_d}</span>
                      </div>
                      <div className="row">
                        <span className="muted">Bajas propias / enemigas</span>
                        <span>{battle.attacker_losses} / {battle.defender_losses}</span>
                      </div>
                      {(battle.deserters ?? 0) > 0 && (
                        <div className="row">
                          <span className="muted">Deserciones</span>
                          <span className="error">
                            {battle.deserters}{battle.rebelled ? " (¡rebelión!)" : ""}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="card">
              <h2>Movimiento</h2>
              <div className="inlineField">
                <input
                  placeholder="provincia destino (#N)"
                  style={{ maxWidth: 160 }}
                  value={moveDest}
                  onChange={(e) => setMoveDest(e.target.value.trim())}
                  aria-label="dbref destino"
                />
                <button
                  className="btn ghost"
                  disabled={busy || !moveDest}
                  onClick={() => act.mutate({ action: "move", dest: moveDest })}
                >
                  Mover campamento
                </button>
              </div>
              <p className="muted" style={{ marginTop: 4 }}>
                Solo provincia vecina: misma región, o en guerra/alianza con ella.
              </p>
            </div>

            <div className="card">
              <h2>Tropa</h2>
              {c.soldiers.map((s) => (
                <div className="row" key={s.id}>
                  <div>
                    <GameIcon id={s.esp} category="units" />#{s.id} {s.esp_nombre}{" "}
                    {s.montado && <span className="pill horse">jinete</span>}
                  </div>
                  <span className="row">
                    <span className="muted">
                      moral {s.moral} · salud {s.salud} · energía {s.energia}
                    </span>
                    {!s.montado && (
                      <button
                        className="btn ghost"
                        disabled={busy}
                        onClick={() => act.mutate({ action: "horse", soldier: s.id })}
                      >
                        Montar
                      </button>
                    )}
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

// Flujo de fundacion del campamento: elige un feudo propio de la casa donde
// plantarlo (la cabeza de casa es el unico comandante posible: es el unico
// Character real; los demas miembros del registro son NPCs sin dbref propio).
// Reemplaza al viejo window.prompt, que devuelve null en el WebView de Capacitor.
function CampPlantForm({
  provinceDbref,
  act,
}: {
  provinceDbref: string;
  act: { isPending: boolean; mutate: (body: Record<string, unknown>) => void };
}) {
  const q = useQuery({
    queryKey: ["army-fiefs", provinceDbref],
    queryFn: () => api.fiefs(provinceDbref),
  });
  const [sel, setSel] = useState("");
  const own = (q.data?.fiefs ?? []).filter((f) => f.role === "owner");

  if (q.isPending) return <p className="muted">Cargando tus feudos…</p>;
  if (!own.length)
    return (
      <p className="error">
        No tienes feudos propios en esta provincia donde plantar el campamento.
      </p>
    );

  return (
    <div className="inlineField" style={{ marginTop: 8 }}>
      <select value={sel} onChange={(e) => setSel(e.target.value)} aria-label="feudo">
        <option value="">Elige un feudo…</option>
        {own.map((f) => (
          <option key={f.coords} value={f.coords}>
            Feudo {f.coords} · {f.biome} · fert {f.fertility}
          </option>
        ))}
      </select>
      <button
        className="btn"
        disabled={act.isPending || !sel}
        onClick={() => act.mutate({ action: "plant", fief: sel })}
      >
        Plantar campamento
      </button>
    </div>
  );
}
