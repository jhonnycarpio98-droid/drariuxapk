import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type NexusSummary,
  type NexusThreadView,
} from "@/api/client";
import { QueryBoundary } from "@/components/ui";

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

  const friends = useMutation({
    mutationFn: (vars: { action: "add_friend" | "remove_friend"; friend: string }) =>
      api.nexusAction(vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nexus"] }),
  });

  return (
    <QueryBoundary q={q}>
      {(d: NexusSummary) => (
        <div>
          <div className="card">
            <h2>Amigos</h2>
            <div className="row">
              <input
                className="input"
                placeholder="casa o jugador…"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
              />
              <button
                className="btn"
                disabled={!ref.trim() || friends.isPending}
                onClick={() => {
                  friends.mutate({ action: "add_friend", friend: ref.trim() });
                  setRef("");
                }}
              >
                Añadir
              </button>
            </div>
            {friends.isError && <p className="error">No se pudo agregar el amigo.</p>}
            {d.friends.length === 0 ? (
              <p className="muted">Sin amigos. Agrega una casa para poder mensajearla.</p>
            ) : (
              d.friends.map((f) => (
                <div className="row" key={f.account_id}>
                  <span>
                    <strong>{f.house}</strong> <span className="muted">({f.name})</span>
                  </span>
                  <span className="row">
                    <button className="btn" onClick={() => onOpen(f.account_id)}>
                      Mensaje
                    </button>
                    <button
                      className="btn ghost"
                      onClick={() => friends.mutate({ action: "remove_friend", friend: String(f.account_id) })}
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
                  <button
                    className="linklike"
                    onClick={() => onOpen(t.account_id)}
                    style={{ textAlign: "left" }}
                  >
                    <strong>{t.house}</strong>
                    {t.unread > 0 && <span className="pill horse"> {t.unread} nuevo</span>}
                    <div className="muted">{t.last}</div>
                  </button>
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
            <p className="error">No es tu amigo: agrégalo en Nexus para mensajearlo.</p>
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
