import { apiUrl } from "@/config";

/** Error de API con código de estado y payload, para que la UI decida. */
export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, payload: unknown, message?: string) {
    super(message ?? `HTTP ${status}`);
    this.status = status;
    this.payload = payload;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    credentials: "include", // sesión por cookie/token del motor
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, data);
  }
  return data as T;
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

// ---------------------------------------------------------------------------
// Tipos de las secciones (espejo de los endpoints JSON del motor)
// ---------------------------------------------------------------------------
export interface Soldier {
  id: number;
  esp: string;
  esp_nombre: string;
  montado: boolean;
  poder: number;
  moral: number;
  salud: number;
  lealtad: number;
  energia: number;
}

export interface CampView {
  dbref: string;
  key: string;
  house: string;
  soldiers: Soldier[];
  count: number;
  power: number;
  commander_level: number;
  commander_xp: number;
  last_pay_year: number | null;
  last_pay_amount: number | null;
}

export interface ArmyState {
  province: string;
  province_dbref: string;
  house: string | null;
  camp: CampView | null;
}

export interface TreasuryGood {
  item: string;
  name: string;
  amount: number;
}

export interface FamilyMember {
  member_id: number | "head";
  name: string;
  role?: string;
  gender?: string;
  age: number;
  salud?: number;
  lealtad?: number;
  inteligencia?: number;
  spouse_id?: number | "head" | null;
}

export interface DynastyState {
  house: string | null;
  leader: { name: string | null; coins: number; energy: number | null; is_player: boolean };
  tree: {
    house: string;
    display: string;
    baptized_day: number;
    member_count: number;
    head: FamilyMember | null;
    members: FamilyMember[];
  } | null;
  treasury: { drariux: number; goods: TreasuryGood[] };
  production: {
    fiefs: {
      dbref: string;
      key: string;
      coords: [number, number];
      is_capital: boolean;
      buildings: { type: string; name: string; level: number }[];
    }[];
    count: number;
  };
}

export interface WalletState {
  mode: "mock" | "live";
  address: string | null;
  chain_balance: number;
  in_game_balance: number;
  denom: string;
  symbol: string;
  chain_id: number;
  log: { kind: string; amount: number; hash: string; addr: string }[];
}

export interface KingdomState {
  province: string;
  province_dbref: string;
  house: string | null;
  management: Record<string, unknown>;
  regent: Record<string, unknown>;
  warehouse: Record<string, unknown> | null;
  market: { offers: Record<string, unknown>[] };
}

export interface MapRegionInfo {
  q: number;
  r: number;
  biome: string;
  zone: string;
  explored: boolean;
  habitable: boolean;
  name: string;
  house: string | null;
  population: number;
}

export interface MapState {
  width: number;
  height: number;
  rows: string[]; // símbolo de bioma por casilla (ancho x alto)
  zones: string[]; // zona climática por fila (solo depende de la latitud)
  oasis: [number, number][]; // casillas con oasis
  regions: MapRegionInfo[]; // regiones materializadas (caminadas/exploradas)
  player: [number, number] | null;
  character: string | null;
}

export interface ActionResult {
  ok: boolean;
  msg?: string;
  added?: number;
  id?: number;
  camp_dbref?: string;
  state?: WalletState;
}

// ---------------------------------------------------------------------------
// API por sección
// ---------------------------------------------------------------------------
export const api = {
  dynasty: () => request<DynastyState>("/api/dynasty/"),
  wallet: () => request<WalletState>("/api/wallet/"),
  army: (province?: string) =>
    request<ArmyState>(`/api/army/${province ? `?province=${encodeURIComponent(province)}` : ""}`),
  kingdom: (province?: string) =>
    request<KingdomState>(
      `/api/kingdom/${province ? `?province=${encodeURIComponent(province)}` : ""}`,
    ),
  news: () => request<unknown>("/api/news/"),
  map: () => request<MapState>("/api/map/"),

  // acciones (POST) -------------------------------------------------------
  mapExplore: (q: number, r: number) =>
    request<ActionResult>("/api/map/explore/", {
      method: "POST",
      body: JSON.stringify({ q, r }),
    }),
  walletAction: (body: Record<string, unknown>) =>
    request<ActionResult>("/api/wallet/action/", { method: "POST", body: JSON.stringify(body) }),
  armyAction: (body: Record<string, unknown>) =>
    request<ActionResult>("/api/army/action/", { method: "POST", body: JSON.stringify(body) }),
  kingdomAction: (body: Record<string, unknown>) =>
    request<ActionResult>("/api/kingdom/action/", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
