import { Link } from "react-router-dom";
import logoUrl from "@/assets/logo.svg";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import {
  DynastyIcon,
  MapIcon,
  NewsIcon,
  KingdomIcon,
  WalletIcon,
} from "@/components/icons";
import { money } from "@/components/ui";

export default function Home() {
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: api.wallet });
  const dynasty = useQuery({ queryKey: ["dynasty"], queryFn: api.dynasty });

  const house = dynasty.data?.tree?.display;
  const drariux = wallet.data?.in_game_balance;

  return (
    <div>
      <div className="home-hero">
        <img src={logoUrl} alt="Civitas" />
        <h1 style={{ margin: 0, color: "var(--gold)", fontSize: 20 }}>Civitas</h1>
        <p className="muted" style={{ margin: 0 }}>
          {house ?? "Tu dinastía"} · Saldo {money(drariux)}
        </p>
      </div>

      <div className="section-cards">
        <Link to="/dynasty" className="section-card">
          <DynastyIcon className="icon" />
          <span className="title">Dinastía</span>
          <span className="muted">Líder · Árbol · Tesorería · Producción</span>
        </Link>
        <Link to="/map" className="section-card">
          <MapIcon className="icon" />
          <span className="title">World Map</span>
          <span className="muted">Reservado (fase final)</span>
        </Link>
        <Link to="/news" className="section-card">
          <NewsIcon className="icon" />
          <span className="title">News</span>
          <span className="muted">Mensajería entre casas</span>
        </Link>
        <Link to="/kingdom" className="section-card">
          <KingdomIcon className="icon" />
          <span className="title">Kingdom Room</span>
          <span className="muted">Mercado · Regencia · Almacén · Ejército</span>
        </Link>
        <Link to="/wallet" className="section-card wide">
          <WalletIcon className="icon" />
          <span className="title">Wallet</span>
          <span className="muted">drariux · dirección · depósito / reintegro</span>
        </Link>
      </div>
    </div>
  );
}
