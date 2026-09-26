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
} from "@/components/icons";
import Home from "@/pages/Home";
import Dynasty from "@/pages/Dynasty";
import WorldMap from "@/pages/WorldMap";
import Nexus from "@/pages/Nexus";
import Kingdom from "@/pages/Kingdom";
import Wallet from "@/pages/Wallet";
import Login from "@/pages/Login";
import { api, isAuthenticated, setToken } from "@/api/client";
import { ensureWallet } from "@/lib/wallet";

const TABS = [
  { to: "/dynasty", label: "Dinastía", Icon: DynastyIcon },
  { to: "/map", label: "Mapa", Icon: MapIcon },
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

  // Al entrar (o al volver a autenticar en este dispositivo), aseguramos que la
  // cuenta tenga su dirección de wallet registrada (idempotente; no pisa una
  // dirección ya existente).
  useEffect(() => {
    if (!authed) return;
    ensureWallet().then(() =>
      queryClient.invalidateQueries({ queryKey: ["wallet"] }),
    );
  }, [authed, queryClient]);

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
        <button type="button" className="btn ghost" onClick={logout}>
          Salir
        </button>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dynasty" element={<Dynasty />} />
          <Route path="/map" element={<WorldMap />} />
          <Route path="/nexus" element={<Nexus />} />
          <Route path="/kingdom" element={<Kingdom />} />
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
