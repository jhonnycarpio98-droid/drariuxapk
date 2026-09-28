import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type NexusSummary,
  type NexusThreadView,
  type NexusSearchResult,
} from "@/api/client";
import { QueryBoundary } from "@/components/ui";
import { HouseLink } from "@/components/HouseProfile";

// Nexus (Hito 5): mensajería directa entre casas + amistades.
export default function Nexus() {
  const [open, setOpen] = useState<number | null>(null); // account_id del hilo abierto

  if (open !== null) {
    return <ThreadView id={open} onBack={() => setOpen(null)} />;
  }
  return <InboxView onOpen={setOpen} />;
}

function InboxView({ onOpen }: { onOpen: (id: number) => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["nexus"], queryFn: () => api.nexus() });
  const [ref, setRef] = useState("");
  const [results, setResults] = useState<NexusSearchResult[] | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["nexus"] });

  // Solicitud de amistad bidireccional (enviar / aceptar / rechazar / cancelar /
  // quitar). El nombre del jugador nunca se muestra: solo la CASA.
  const friends = useMutation({
    mutationFn: (vars: {
      action:
        | "add_friend"
        | "accept_friend"
        | "reject_friend"
        | "cancel_friend"
        | "remove_friend";
      friend: string;
    }) => api.nexusAction(vars),
    onSuccess: () => invalidate(),
  });

  const search = useMutation({
    mutationFn: (term: string) => api.nexusSearch(term),
    onSuccess: (r) => setResults(r.results ?? []),
  });

  const act = (
    action: "add_friend" | "accept_friend" | "reject_friend" | "cancel_friend" | "remove_friend",
    friend: string,
  ) => friends.mutate({ action, friend });

  return (
    <QueryBoundary q={q}>
      {(d: NexusSummary) => (
        <div>
          <div className="card">
            <h2>Buscar casa</h2>
            <div className="row">
              <input
                className="input"
                placeholder="nombre de la casa…"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && ref.trim()) search.mutate(ref.trim());
                }}
              />
              <button
                className="btn"
                disabled={!ref.trim() || search.isPending}
                onClick={() => search.mutate(ref.trim())}
              >
                Buscar
              </button>
            </div>
            {results && results.length === 0 && (
              <p className="muted">Sin coincidencias.</p>
            )}
            {results?.map((r) => (
              <div className="row" key={r.account_id}>
                <HouseLink accountId={r.account_id} label={r.house} />
                <span className="row">
                  {r.is_friend ? (
                    <>
                      <button className="btn" onClick={() => onOpen(r.account_id)}>
                        Mensaje
                      </button>
                      <button
                        className="btn ghost"
                        onClick={() => act("remove_friend", String(r.account_id))}
                      >
                        Quitar
                      </button>
                    </>
                  ) : r.requested_by_them ? (
                    <>
                      <button className="btn" onClick={() => act("accept_friend", String(r.account_id))}>
                        Aceptar
                      </button>
                      <button className="btn ghost" onClick={() => act("reject_friend", String(r.account_id))}>
                        Rechazar
                      </button>
                    </>
                  ) : r.requested_by_you ? (
                    <button className="btn ghost" onClick={() => act("cancel_friend", String(r.account_id))}>
                      Solicitada · Cancelar
                    </button>
                  ) : (
                    <button className="btn" onClick={() => act("add_friend", String(r.account_id))}>
                      Solicitar amistad
                    </button>
                  )}
                </span>
              </div>
            ))}
            {friends.isError && <p className="error">No se pudo actualizar la amistad.</p>}
          </div>

          {(d.requests_in?.length ?? 0) > 0 && (
            <div className="card">
              <h2>Solicitudes recibidas</h2>
              {d.requests_in.map((f) => (
                <div className="row" key={f.account_id}>
                  <HouseLink accountId={f.account_id} label={f.house} />
                  <span className="row">
                    <button className="btn" onClick={() => act("accept_friend", String(f.account_id))}>
                      Aceptar
                    </button>
                    <button className="btn ghost" onClick={() => act("reject_friend", String(f.account_id))}>
                      Rechazar
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <h2>Amigos</h2>
            {d.friends.length === 0 ? (
              <p className="muted">
                Sin amigos. Busca una casa y envíale una solicitud; cuando la acepte
                podréis mensajearos.
              </p>
            ) : (
              d.friends.map((f) => (
                <div className="row" key={f.account_id}>
                  <HouseLink accountId={f.account_id} label={f.house} />
                  <span className="row">
                    <button className="btn" onClick={() => onOpen(f.account_id)}>
                      Mensaje
                    </button>
                    <button
                      className="btn ghost"
                      onClick={() => act("remove_friend", String(f.account_id))}
                    >
                      Quitar
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="card">
            <h2>Conversaciones</h2>
            {d.threads.length === 0 ? (
              <p className="muted">Aún no has intercambiado mensajes con nadie.</p>
            ) : (
              d.threads.map((t) => (
                <div className="row" key={t.account_id}>
                  <div style={{ textAlign: "left" }}>
                    <HouseLink accountId={t.account_id} label={t.house} />
                    {t.unread > 0 && <span className="pill horse"> {t.unread} nuevo</span>}
                    <div className="muted">{t.last}</div>
                  </div>
                  <button className="btn" onClick={() => onOpen(t.account_id)}>
                    Abrir
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </QueryBoundary>
  );
}

function ThreadView({ id, onBack }: { id: number; onBack: () => void }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const q = useQuery({
    queryKey: ["nexus-thread", id],
    queryFn: () => api.nexusThread(id),
  });

  const send = useMutation({
    mutationFn: (text: string) => api.nexusAction({ action: "send", to: id, body: text }),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["nexus-thread", id] });
      qc.invalidateQueries({ queryKey: ["nexus"] });
    },
  });

  return (
    <QueryBoundary q={q}>
      {(d: NexusThreadView) => (
        <div className="card">
          <div className="row" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>{d.with_house}</h2>
            <button className="btn ghost" onClick={onBack}>
              ← Volver
            </button>
          </div>
          {!d.is_friend && (
            <p className="error">
              No sois amigos todavía: envíale una solicitud de amistad desde Nexus y,
              cuando la acepte, podrás mensajearlo.
            </p>
          )}
          <div className="thread">
            {d.messages.length === 0 ? (
              <p className="muted">Sin mensajes todavía.</p>
            ) : (
              d.messages.map((m) => (
                <div key={m.id} className={m.mine ? "bubble mine" : "bubble"}>
                  <div>{m.body}</div>
                  <span className="muted small">
                    {m.mine ? "tú" : m.from}
                    {m.date ? ` · ${new Date(m.date).toLocaleString()}` : ""}
                  </span>
                </div>
              ))
            )}
          </div>
          {send.isError && <p className="error">No se pudo enviar (¿es tu amigo?).</p>}
          <div className="row" style={{ marginTop: 8 }}>
            <input
              className="input"
              placeholder="Escribe un mensaje…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && body.trim() && d.is_friend) send.mutate(body.trim());
              }}
            />
            <button
              className="btn"
              disabled={!body.trim() || !d.is_friend || send.isPending}
              onClick={() => send.mutate(body.trim())}
            >
              {send.isPending ? "…" : "Enviar"}
            </button>
          </div>
        </div>
      )}
    </QueryBoundary>
  );
}
