import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { QueryBoundary } from "@/components/ui";

interface MailMessage {
  subject?: string;
  body?: string;
  sender?: string;
  timestamp?: string;
  thread_subject?: string;
}

// /api/news/ devuelve la bandeja de la casa; se tolera cualquier forma.
export default function News() {
  const q = useQuery({ queryKey: ["news"], queryFn: api.news });

  return (
    <div>
      <QueryBoundary q={q}>
        {(data) => {
          const box = normalizeMessages(data);
          return (
            <div className="card">
              <h2>Bandeja de la casa</h2>
              {box.length === 0 ? (
                <p className="muted">Sin mensajes. (Límite: 500 por casa.)</p>
              ) : (
                box.map((m, i) => (
                  <div className="row" key={i}>
                    <div>
                      <strong>{m.subject || "(sin asunto)"}</strong>
                      <div className="muted">{m.sender ?? ""}</div>
                    </div>
                    <span className="muted">{m.timestamp ?? ""}</span>
                  </div>
                ))
              )}
              <p className="muted" style={{ marginTop: 12 }}>
                Redactar y responder desde el webclient de consola del motor.
              </p>
            </div>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

function normalizeMessages(data: unknown): MailMessage[] {
  if (Array.isArray(data)) return data as MailMessage[];
  const d = data as Record<string, unknown> | null;
  if (!d) return [];
  for (const k of ["messages", "inbox", "threads", "items"]) {
    const v = d[k];
    if (Array.isArray(v)) {
      return v.map((x: Record<string, unknown>) => ({
        subject: (x.subject ?? x.thread_subject) as string | undefined,
        body: x.body as string | undefined,
        sender: (x.sender_name ?? x.sender ?? x.from) as string | undefined,
        timestamp: (x.timestamp ?? x.date_created) as string | undefined,
      }));
    }
  }
  return [];
}
