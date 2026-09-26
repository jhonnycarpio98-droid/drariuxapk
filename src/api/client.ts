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

// ---------------------------------------------------------------------------
// Token de sesión (auth sin cookies para el WebView de Capacitor).
// El motor emite un token opaco en /api/auth/login/; lo guardamos en el
// almacenamiento local del dispositivo y lo enviamos en cada petición como
// "Authorization: Token <valor>". Así la app no depende de cookies de sesión,
// que no viajan desde el origen https://localhost del WebView.
// ---------------------------------------------------------------------------
const TOKEN_KEY = "civitas.token";

export function getToken(): string | null {
  try {
    return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) globalThis.localStorage?.setItem(TOKEN_KEY, token);
    else globalThis.localStorage?.removeItem(TOKEN_KEY);
  } catch {
    /* almacenamiento no disponible */
  }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (token) headers["Authorization"] = `Token ${token}`;

  const res = await fetch(apiUrl(path), {
    credentials: "include", // sesión por cookie/token del motor
    ...init,
    headers,
  });
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, data);
  }
  // El motor respondió 2xx pero con un cuerpo que no es JSON. Típico de un
  // 302 a la página de login cuando el token caducó (p. ej. tras reiniciar el
  // servidor): fetch sigue la redirección y acaba en el HTML del login, que
  // llega como ok. Lo tratamos como sesión caducada para que cada panel muestre
  // su estado de error amigable en vez de reventar el árbol de React.
  const ct = res.headers.get("content-type") || "";
  if (data === null || (typeof data === "string" && !ct.includes("application/json"))) {
    throw new ApiError(401, { error: "sesion", msg: "Sesión caducada. Vuelve a entrar." });
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
  polity?: Record<string, unknown>;
  management: Record<string, unknown>;
  regent: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Comercio por solicitudes (Hito 4)
// ---------------------------------------------------------------------------
export interface CommerceCofre {
  item: string;
  nombre: string;
  qty: number;
  for_sale: boolean;
}

export interface CommerceListing {
  house: string;
  seller_account: number;
  seller: string;
  item: string;
  nombre: string;
  price: number;
  available: number;
}

export interface CommerceRequest {
  id: string;
  item: string;
  qty: number;
  price: number;
  status: string; // pendiente | contraoferta
  buyer_account: number;
  buyer_house: string;
  seller_house: string;
  created: string;
}

export interface CommerceState {
  house: string;
  prices: Record<string, number>;
  cofre: CommerceCofre[];
  catalog: CommerceListing[];
  incoming: CommerceRequest[];
  outgoing: CommerceRequest[];
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
// Nexus (Hito 5): amistades + conversaciones
// ---------------------------------------------------------------------------
export interface NexusFriend {
  account_id: number;
  name: string;
  house: string;
}

export interface NexusThread {
  account_id: number;
  name: string;
  house: string;
  last: string;
  when: string | null;
  count: number;
  unread: number;
  is_friend: boolean;
}

export interface NexusMessage {
  id: number;
  mine: boolean;
  from: string;
  body: string;
  date: string | null;
  unread: boolean;
}

export interface NexusSummary {
  threads: NexusThread[];
  friends: NexusFriend[];
  counts: Record<string, number>;
}

export interface NexusThreadView {
  with_account: number;
  with_house: string;
  is_friend: boolean;
  messages: NexusMessage[];
}

// ---------------------------------------------------------------------------
// Población (Hito 6): censo + hambre/rebelión + gestores
// ---------------------------------------------------------------------------
export interface PopulationProvince {
  provincia: string;
  dbref: string;
  biome: string;
  agua: string | null;
  region: string | null;
  libre: number;
  siervos: number;
  reclutas: number;
  ciudadela: number;
  total: number;
  dependientes: number;
  necesidad_anual_kg: { grano_kg: number; proteina_kg: number };
  grano_disponible: number;
  grano_necesario: number;
  cobertura: number;
  estabilidad: number;
  hambruna: boolean;
  rebeldia: boolean;
}

export interface PopulationCensus {
  house: string | null;
  title: string | null;
  title_label: string | null;
  is_king: boolean;
  regions_governed: number;
  totals: Record<string, number>;
  provinces: PopulationProvince[];
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
  commerce: () => request<CommerceState>("/api/commerce/"),
  population: () => request<PopulationCensus>("/api/population/"),
  nexus: () => request<NexusSummary>("/api/nexus/"),
  nexusThread: (withRef: number | string) =>
    request<NexusThreadView>(`/api/nexus/?with=${encodeURIComponent(String(withRef))}`),

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
  kingdomInvite: (body: Record<string, unknown>) =>
    request<{ ok: boolean; code?: string; province?: string; error?: string }>(
      "/api/kingdom/invite/",
      { method: "POST", body: JSON.stringify(body) },
    ),
  commerceAction: (body: Record<string, unknown>) =>
    request<
      ActionResult & {
        error?: string;
        prices?: Record<string, number>;
        request?: CommerceRequest;
      }
    >("/api/commerce/", { method: "POST", body: JSON.stringify(body) }),
  dynastyAction: (body: Record<string, unknown>) =>
    request<ActionResult & { error?: string; tree?: DynastyState["tree"] }>(
      "/api/dynasty/action/",
      { method: "POST", body: JSON.stringify(body) },
    ),
  populationAction: (body: Record<string, unknown>) =>
    request<ActionResult & { error?: string; moved?: number; province?: PopulationProvince }>(
      "/api/population/",
      { method: "POST", body: JSON.stringify(body) },
    ),
  nexusAction: (body: Record<string, unknown>) =>
    request<ActionResult & { error?: string; friends?: NexusFriend[]; to_house?: string }>(
      "/api/nexus/",
      { method: "POST", body: JSON.stringify(body) },
    ),

  // autenticación (token) --------------------------------------------------
  auth: {
    login: (username: string, password: string) =>
      request<{ token: string; username: string }>("/api/auth/login/", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }),
    register: (
      username: string,
      password: string,
      opts: { email?: string; house?: string; vassalCode?: string } = {},
    ) =>
      request<{ token: string; username: string; house?: string; role?: string }>(
        "/api/auth/register/",
        {
          method: "POST",
          body: JSON.stringify({
            username,
            password,
            email: opts.email ?? "",
            house: opts.house ?? "",
            vassal_code: opts.vassalCode ?? "",
          }),
        },
      ),
    logout: () => request<{ ok: boolean }>("/api/auth/logout/", { method: "POST" }),
  },
};
