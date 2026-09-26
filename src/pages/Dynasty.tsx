import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, type FamilyMember, type DynastyState } from "@/api/client";
import { QueryBoundary, money } from "@/components/ui";

const SUBS = ["Líder", "Árbol", "Gestionar", "Tesorería", "Producción"] as const;

export default function Dynasty() {
  const [sub, setSub] = useState<(typeof SUBS)[number]>("Líder");
  const q = useQuery({ queryKey: ["dynasty"], queryFn: api.dynasty });

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

      <QueryBoundary q={q}>
        {(d) => {
          if (sub === "Líder")
            return (
              <div className="card">
                <h2>{d.tree?.head?.name ?? d.leader.name ?? "Sin cabeza"}</h2>
                <div className="row">
                  <span className="muted">Casa</span>
                  <span>{d.tree?.display ?? "—"}</span>
                </div>
                <div className="row">
                  <span className="muted">Drariux</span>
                  <span>{money(d.leader.coins)}</span>
                </div>
                {d.tree?.head && (
                  <>
                    <div className="row">
                      <span className="muted">Edad</span>
                      <span>{d.tree.head.age}</span>
                    </div>
                    <MemberStats m={d.tree.head} />
                  </>
                )}
              </div>
            );

          if (sub === "Árbol") return <TreePanel d={d} />;
          if (sub === "Gestionar") return <ManagePanel d={d} onDone={() => q.refetch()} />;

          if (sub === "Tesorería")
            return (
              <div className="card">
                <h2>Tesorería</h2>
                <div className="row">
                  <span className="muted">drariux (espejo)</span>
                  <span>{money(d.treasury.drariux)}</span>
                </div>
                <h2 style={{ marginTop: 16 }}>Almacén de la casa</h2>
                {d.treasury.goods.length === 0 ? (
                  <p className="muted">Sin mercancías.</p>
                ) : (
                  d.treasury.goods.map((g) => (
                    <div className="row" key={g.item}>
                      <span>{g.name}</span>
                      <span>{g.amount.toLocaleString("es")}</span>
                    </div>
                  ))
                )}
              </div>
            );

          // Producción
          return (
            <div className="card">
              <h2>Producción · {d.production.count} feudos</h2>
              {d.production.fiefs.length === 0 && (
                <p className="muted">Aún no posees feudos.</p>
              )}
              {d.production.fiefs.map((f) => (
                <div className="card" key={f.dbref} style={{ background: "var(--bg-elev)" }}>
                  <h2 style={{ fontSize: 14 }}>
                    {f.key} {f.is_capital && <span className="pill">capital</span>}
                  </h2>
                  {f.buildings.length === 0 ? (
                    <p className="muted">Sin edificios.</p>
                  ) : (
                    f.buildings.map((b) => (
                      <div className="row" key={b.type}>
                        <span>{b.name}</span>
                        <span className="pill">Nv {b.level}</span>
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

function TreePanel({ d }: { d: DynastyState }) {
  return (
    <div className="card">
      <h2>Árbol genealógico</h2>
      {d.tree ? (
        <>
          {d.tree.head && (
            <div className="row">
              <div>
                <strong>{d.tree.head.name}</strong> <span className="pill">Señor/a</span>
              </div>
              <span className="muted">{d.tree.head.age} años</span>
            </div>
          )}
          {d.tree.members.map((m) => (
            <div className="row" key={String(m.member_id)}>
              <div>
                {m.name} <span className="pill">{m.role ?? "miembro"}</span>
              </div>
              <span className="muted">{m.age} años</span>
            </div>
          ))}
          <p className="muted">Total de miembros vivos: {d.tree.member_count}</p>
        </>
      ) : (
        <p className="muted">Sin casa bautizada todavía.</p>
      )}
    </div>
  );
}

/**
 * Gestión de la casa: matrimonios y heredero. Espejo API de los comandos
 * `casarse`, `casar <miembro> = <npc>` y `heredero`. Solo el cabeza puede
 * operar (el motor responde 403 en caso contrario); los límites de edad,
 * membresía y tamaño los valida el motor, y aquí mostramos su mensaje.
 */
function ManagePanel({ d, onDone }: { d: DynastyState; onDone: () => void }) {
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const act = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.dynastyAction(body),
    onSuccess: (res) => {
      setFeedback({ ok: !!res.ok, msg: res.msg ?? String(res.error ?? "Listo.") });
      onDone();
    },
    onError: (e: unknown) => {
      // El motor responde los rechazos de negocio (ya casado, sin autoridad,
      // edad insuficiente...) como 4xx con {ok:false,msg}. client.ts lanza
      // ApiError con `.payload`; sacamos de ahí el mensaje amigable en vez del
      // genérico "HTTP 400".
      const payload = (e as { payload?: { msg?: string; error?: string } })?.payload;
      const msg =
        payload?.msg ??
        payload?.error ??
        (e instanceof Error && e.message ? e.message : "No se pudo completar.");
      setFeedback({ ok: false, msg });
    },
  });
  const busy = act.isPending;
  const tree = d.tree;
  const members = tree?.members ?? [];
  const isHead = d.leader.is_player;

  const askName = (label: string) => window.prompt(label)?.trim() || null;

  return (
    <div>
      {!tree && (
        <div className="card">
          <p className="muted">Aún no tienes casa bautizada. Fóndala desde el juego.</p>
        </div>
      )}

      {tree && !isHead && (
        <div className="card">
          <p className="muted">
            Solo el señor/a de la casa puede gestionarla. Tu personaje no es el cabeza
            ({tree.head?.name ?? "—"}).
          </p>
        </div>
      )}

      {tree && isHead && (
        <>
          <div className="card">
            <h2>Matrimonio del cabeza</h2>
            <p className="muted">
              {tree.head?.name ?? "Señor/a"} · {tree.head?.age ?? "—"} años. El cónyuge entra
              en la casa y la pareja podrá tener descendencia con el tiempo.
            </p>
            <div className="actions">
              <button
                className="btn"
                disabled={busy}
                onClick={() => {
                  const name = askName("Nombre del NPC con quien casar al cabeza:");
                  if (name) act.mutate({ action: "marry_head", name });
                }}
              >
                Casar cabeza
              </button>
            </div>
          </div>

          <div className="card">
            <h2>Miembros</h2>
            {members.length === 0 && <p className="muted">No hay otros miembros todavía.</p>}
            {members.map((m) => (
              <div className="row" key={String(m.member_id)}>
                <div>
                  {m.name} <span className="pill">{m.role ?? "miembro"}</span>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {m.age} años{m.spouse_id != null ? " · casado/a" : ""}
                  </div>
                </div>
                <div className="actions" style={{ gap: 6 }}>
                  <button
                    className="btn ghost"
                    disabled={busy || m.spouse_id != null}
                    onClick={() => {
                      const name = askName(`Nombre del NPC para casar a ${m.name}:`);
                      if (name) act.mutate({ action: "marry_member", member: m.name, name });
                    }}
                  >
                    Casar
                  </button>
                  <button
                    className="btn ghost"
                    disabled={busy || m.role === "heredero"}
                    onClick={() => act.mutate({ action: "heir", name: m.name })}
                  >
                    Heredero
                  </button>
                </div>
              </div>
            ))}
          </div>

          {feedback && (
            <p className={feedback.ok ? "ok" : "error"}>{feedback.msg}</p>
          )}
        </>
      )}
    </div>
  );
}

function MemberStats({ m }: { m: FamilyMember }) {
  return (
    <>
      <div className="row">
        <span className="muted">Lealtad</span>
        <span>{m.lealtad ?? "—"}</span>
      </div>
      <div className="row">
        <span className="muted">Inteligencia</span>
        <span>{m.inteligencia ?? "—"}</span>
      </div>
      <div className="row">
        <span className="muted">Salud</span>
        <span>{m.salud ?? "—"}</span>
      </div>
    </>
  );
}
