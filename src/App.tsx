import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import logoUrl from "@/assets/logo.svg";
import {
  DynastyIcon,
  MapIcon,
  NewsIcon,
  KingdomIcon,
  WalletIcon,
} from "@/components/icons";
import Home from "@/pages/Home";
import Dynasty from "@/pages/Dynasty";
import WorldMap from "@/pages/WorldMap";
import News from "@/pages/News";
import Kingdom from "@/pages/Kingdom";
import Wallet from "@/pages/Wallet";

const TABS = [
  { to: "/dynasty", label: "Dinastía", Icon: DynastyIcon },
  { to: "/map", label: "Mapa", Icon: MapIcon },
  { to: "/news", label: "News", Icon: NewsIcon },
  { to: "/kingdom", label: "Reino", Icon: KingdomIcon },
  { to: "/wallet", label: "Wallet", Icon: WalletIcon },
];

export default function App() {
  const { pathname } = useLocation();
  const isHome = pathname === "/";
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src={logoUrl} alt="Civitas" />
          <span>CIVITAS</span>
        </div>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dynasty" element={<Dynasty />} />
          <Route path="/map" element={<WorldMap />} />
          <Route path="/news" element={<News />} />
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
