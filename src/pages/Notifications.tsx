import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type NotificationsState } from "@/api/client";
import { QueryBoundary } from "@/components/ui";

// Pestaña de Notificaciones: feed de eventos de TU casa (familia, servidumbre,
// gobierno, economía, militar y alertas). No es mensajería entre casas (eso es
// Nexus); aquí solo aparece lo que ocurre a tu gente y tus tierras.

const KIND_META: Record<string, { label: string; emoji: string }> = {
  familia: { label: "Familia", emoji: "👶" },
  servidumbre: { label: "Servidumbre", emoji: "🧵" },
  gobierno: { label: "Gobierno", emoji: "👑" },
  economia: { label: "Economía", emoji: "🌾" },
  militar: { label: "Militar", emoji: "⚔️" },
  alerta: { label: "Alerta", emoji: "⚠️" },
};

export default function Notifications() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["notifications"], queryFn: () => api.notifications() });

  const act = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.notificationsAction(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <QueryBoundary q={q}>
      {(d: NotificationsState) => {
        const items = d.notifications;
        return (
          <div>
            <div className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h2>Notificaciones</h2>
                <span className="muted">
                  {d.counts.unread} sin leer / {d.counts.total}
                </span>
              </div>
              <div className="row">
                <button
                  className="btn ghost"
                  disabled={!d.counts.unread || act.isPending}
                  onClick={() => act.mutate({ action: "read_all" })}
                >
                  Marcar todo como leído
                </button>
                <button
                  className="btn ghost"
                  disabled={!d.counts.total || act.isPending}
                  onClick={() => {
                    if (confirm("¿Vaciar el feed de notificaciones?"))
                      act.mutate({ action: "clear" });
                  }}
                >
                  Vaciar
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <p className="muted">
                Aún no hay noticias de tu casa. Los nacimientos, muertes, bodas,
                deserciones y nombramientos aparecerán aquí.
              </p>
            ) : (
              items.map((n) => {
                const meta = KIND_META[n.kind] || { label: n.kind, emoji: "•" };
                return (
                  <div
                    key={n.id}
                    className="card"
                    style={{ opacity: n.unread ? 1 : 0.62 }}
                  >
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span>
                        <strong>
                          {meta.emoji} {meta.label}
                        </strong>
                        {n.unread && (
                          <span className="muted"> · <b>nuevo</b></span>
                        )}
                      </span>
                      <span className="muted">día {n.day}</span>
                    </div>
                    <p style={{ margin: "6px 0 0" }}>{n.text}</p>
                    {n.unread && (
                      <div className="row" style={{ marginTop: 6 }}>
                        <button
                          className="btn ghost"
                          disabled={act.isPending}
                          onClick={() => act.mutate({ action: "read", id: n.id })}
                        >
                          Marcar leído
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        );
      }}
    </QueryBoundary>
  );
}
