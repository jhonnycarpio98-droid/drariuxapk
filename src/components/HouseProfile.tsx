import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type HouseProfile } from "@/api/client";
import { QueryBoundary } from "@/components/ui";

/**
 * Perfil de CASA (no del jugador): al pinchar un nombre de casa se abre un
 * modal con su rol político (rey / gobernador / vasallo), regiones y provincias
 * que gobierna. El nombre de usuario del jugador NUNCA se muestra: solo «Casa X».
 */
export function HouseProfileModal({
  accountId,
  onClose,
}: {
  accountId: number | string;
  onClose: () => void;
}) {
  const q = useQuery({
    queryKey: ["house-profile", String(accountId)],
    queryFn: () => api.houseProfile(accountId),
    enabled: accountId != null && String(accountId) !== "",
  });
  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 style={{ margin: 0 }}>Perfil de la casa</h2>
          <button className="btn ghost" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <QueryBoundary q={q}>
          {(p: HouseProfile) => {
            if (!p.ok) {
              return <p className="error">{p.error ?? "Casa no encontrada."}</p>;
            }
            if (!p.has_house) {
              return <p className="muted">Esa casa aún no tiene linaje establecido.</p>;
            }
            return (
              <div>
                <h3 style={{ marginTop: 0 }}>{p.display ?? `Casa ${p.house}`}</h3>
                <div className="row">
                  <span className="muted">Rango</span>
                  <span className="pill">{p.title_label ?? "Sin título"}</span>
                </div>
                <div className="row">
                  <span className="muted">Regiones gobernadas</span>
                  <span>{p.regions_governed ?? 0}</span>
                </div>
                <div className="row">
                  <span className="muted">Miembros</span>
                  <span>{p.member_count ?? 0}</span>
                </div>
                {p.overlord && (
                  <div className="row">
                    <span className="muted">Señor feudal</span>
                    <span>Casa {p.overlord}</span>
                  </div>
                )}
                {p.king_house && (
                  <div className="row">
                    <span className="muted">Casa reinante</span>
                    <span>Casa {p.king_house}</span>
                  </div>
                )}
                <h4 style={{ marginBottom: 4 }}>Provincias</h4>
                {!p.provinces || p.provinces.length === 0 ? (
                  <p className="muted">Sin provincias bajo su control.</p>
                ) : (
                  p.provinces.map((pv) => (
                    <div className="row" key={pv.name}>
                      <span>{pv.name}</span>
                      <span className="muted">{pv.vassal ? "vasalla" : "propia"}</span>
                    </div>
                  ))
                )}
                <div className="row">
                  <span className="muted">Relación contigo</span>
                  <span>{p.is_friend ? "Amistad mutua" : "No amici"}</span>
                </div>
              </div>
            );
          }}
        </QueryBoundary>
      </div>
    </div>
  );
}

/**
 * Nombre de casa clicable: abre el perfil al pinchar. Se usa en Nexus, comercio
 * y diplomacia donde solo se muestra el nombre de la casa (nunca el jugador).
 */
export function HouseLink({
  accountId,
  label,
}: {
  accountId: number | string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="house-link"
        onClick={() => setOpen(true)}
        title="Ver perfil de la casa"
      >
        {label}
      </button>
      {open && (
        <HouseProfileModal accountId={accountId} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
