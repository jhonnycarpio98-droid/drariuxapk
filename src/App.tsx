import { useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import logoUrl from "@/assets/logo.svg";
import {
  DynastyIcon,
  MapIcon,
  NexusIcon,
  KingdomIcon,
  WalletIcon,
  AgricultureIcon,
  ProductionIcon,
  LivestockIcon,
  BellIcon,
} from "@/components/icons";
import Home from "@/pages/Home";
import Dynasty from "@/pages/Dynasty";
import WorldMap from "@/pages/WorldMap";
import Nexus from "@/pages/Nexus";
import Kingdom from "@/pages/Kingdom";
import Agricultura from "@/pages/Agricultura";
import Produccion from "@/pages/Produccion";
import Ganaderia from "@/pages/Ganaderia";
import Wallet from "@/pages/Wallet";
import Notifications from "@/pages/Notifications";
import Login from "@/pages/Login";
import { api, isAuthenticated, setToken } from "@/api/client";
import { ensureWallet } from "@/lib/wallet";
import { initPush, notifyNew } from "@/lib/notifications";

const TABS = [
  { to: "/dynasty", label: "Dinastía", Icon: DynastyIcon },
  { to: "/map", label: "Mapa", Icon: MapIcon },
  { to: "/agricultura", label: "Agricultura", Icon: AgricultureIcon },
  { to: "/ganaderia", label: "Ganadería", Icon: LivestockIcon },
  { to: "/produccion", label: "Edificios", Icon: ProductionIcon },
  { to: "/nexus", label: "Nexus", Icon: NexusIcon },
  { to: "/kingdom", label: "Reino", Icon: KingdomIcon },
  { to: "/wallet", label: "Wallet", Icon: WalletIcon },
];

export default function App() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  // La sesión vive en un token local: si existe, dentro; si no, pantalla de acceso.
  const [authed, setAuthed] = useState(isAuthenticated());
  // Avisos (t14): campana en la barra superior junto a Salir, con contador de
  // sin-leer alimentado por el sondeo de notificaciones.
  const [unread, setUnread] = useState(0);

  // Al entrar (o al volver a autenticar en este dispositivo), aseguramos que la
  // cuenta tenga su dirección de wallet registrada (idempotente; no pisa una
  // dirección ya existente).
  useEffect(() => {
    if (!authed) return;
    ensureWallet().then(() =>
      queryClient.invalidateQueries({ queryKey: ["wallet"] }),
    );
  }, [authed, queryClient]);

  // Notificaciones en el teléfono: pedimos permiso y consultamos el feed de la
  // casa en segundo plano; cada evento nuevo (nacimiento, muerte, boda,
  // deserción, nombramiento, alerta) dispara una notificación local.
  useEffect(() => {
    if (!authed) return;
    let alive = true;
    initPush();
    async function poll() {
      try {
        const d = await api.notifications();
        if (!alive) return;
        setUnread(d.counts?.unread ?? 0);
        if (d.notifications.length) await notifyNew(d.notifications);
      } catch {
        /* sin sesión/red: reintentamos en el próximo tick */
      }
    }
    poll();
    const t = setInterval(poll, 20000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [authed]);

  async function logout() {
    try {
      await api.auth.logout();
    } catch {
      /* mejor esfuerzo: borramos el token local igualmente */
    }
    setToken(null);
    queryClient.clear();
    setAuthed(false);
    navigate("/", { replace: true });
  }

  if (!authed) {
    return <Login onAuthed={() => setAuthed(true)} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
          <img src={logoUrl} alt="Civitas" />
          <span>CIVITAS</span>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="btn ghost bell"
            onClick={() => navigate("/notifications")}
            aria-label="Avisos"
            title="Avisos"
          >
            <BellIcon />
            {unread > 0 && <span className="badge">{unread > 99 ? "99+" : unread}</span>}
          </button>
          <button type="button" className="btn ghost" onClick={logout}>
            Salir
          </button>
        </div>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dynasty" element={<Dynasty />} />
          <Route path="/map" element={<WorldMap />} />
          <Route path="/nexus" element={<Nexus />} />
          <Route path="/kingdom" element={<Kingdom />} />
          <Route path="/agricultura" element={<Agricultura />} />
          <Route path="/ganaderia" element={<Ganaderia />} />
          <Route path="/produccion" element={<Produccion />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>

      {!isHome && (
        <nav className="tabbar">
          {TABS.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `tab${isActive ? " active" : ""}`}>
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
