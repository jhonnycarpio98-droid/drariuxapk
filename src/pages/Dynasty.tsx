import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type FamilyMember } from "@/api/client";
import { QueryBoundary, money } from "@/components/ui";

const SUBS = ["Líder", "Árbol", "Tesorería", "Producción"] as const;

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

          if (sub === "Árbol")
            return (
              <div className="card">
                <h2>Árbol genealógico</h2>
                {d.tree ? (
                  <>
                    {d.tree.head && (
                      <div className="row">
                        <div>
                          <strong>{d.tree.head.name}</strong>{" "}
                          <span className="pill">Señor/a</span>
                        </div>
                        <span className="muted">{d.tree.head.age} años</span>
                      </div>
                    )}
                    {d.tree.members.map((m) => (
                      <div className="row" key={String(m.member_id)}>
                        <div>
                          {m.name}{" "}
                          <span className="pill">{m.role ?? "miembro"}</span>
                        </div>
                        <span className="muted">{m.age} años</span>
                      </div>
                    ))}
                    <p className="muted">
                      Total de miembros vivos: {d.tree.member_count}
                    </p>
                  </>
                ) : (
                  <p className="muted">Sin casa bautizada todavía.</p>
                )}
              </div>
            );

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
