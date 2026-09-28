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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Estados que merecen reintento: caídas transitorias del motor/borde (5xx,
// timeouts, rate-limit). Un 4xx real (401/403/400) NO se reintenta.
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504, 520, 521, 522, 524, 525]);

/**
 * fetch con reintento automático y espera creciente. Absorbe los micro-cortes
 * intermitentes entre el dispositivo y Cloudflare/Evennia que antes se
 * traducían en "no se pudo conectar" a la primera de cambio.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempts = 3
): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      if ((res.status >= 500 || RETRYABLE_STATUS.has(res.status)) && i < attempts - 1) {
        await sleep(400 * (i + 1));
        continue; // reintento ante estado transitorio
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await sleep(400 * (i + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Fallo de red");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (token) headers["Authorization"] = `Token ${token}`;

  const res = await fetchWithRetry(apiUrl(path), {
    // Auth por token (cabecera Authorization), NO por cookie de sesión. Enviar
    // credentials haría que el navegador/WebView exigiera Access-Control-Allow-
    // Credentials en una petición cross-origin (origen https://localhost en el
    // APK), y el motor no lo manda => "error de red". Con "omit" la CORS simple
    // ya pasa y el token viaja igual en la cabecera.
    credentials: "omit",
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

export interface CampLogistics {
  weapons: Record<string, number>;
  arrows: number;
  clothing: number;
  forage: number;
  grain: number;
  mounted: number;
  need_forage_day: number;
  need_grain_day: number;
  ropa_ciclo: number;
}

export interface CampView {
  dbref: string;
  key: string;
  house: string;
  commander?: string;
  soldiers: Soldier[];
  count: number;
  power: number;
  commander_level: number;
  commander_xp: number;
  last_pay_year: number | null;
  last_pay_amount: number | null;
  prisoners?: number;
  ropa_ciclo?: number;
  is_detachment?: boolean;
  logistics?: CampLogistics | null;
}

export interface ArmyState {
  province: string;
  province_dbref: string;
  house: string | null;
  camp: CampView | null;
}

export interface BattleResult {
  winner: string;
  loser: string;
  biome?: string;
  power_a?: number;
  power_d?: number;
  attacker_losses?: number;
  defender_losses?: number;
  deserters?: number;
  rebelled?: boolean;
  note?: string;
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

export interface WalletPrice {
  atom_usd: number;
  rate_drx_per_usd: number;
  source: string;
}

export interface FundQuote {
  atom_amount: number;
  atom_usd: number;
  usd_value: number;
  rate_drx_per_usd: number;
  drx: number;
  symbol: string;
  price_source: string;
}

export interface WalletState {
  mode: "mock" | "live";
  address: string | null;
  chain_balance: number;
  in_game_balance: number;
  denom: string;
  symbol: string;
  chain_id: number;
  price?: WalletPrice | null;
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
// Diplomacia entre reinos (Hito 9 / plan 2G)
// ---------------------------------------------------------------------------
export type DiploState =
  | "war"
  | "peace"
  | "alliance"
  | "vassalage_offer"
  | "trade_agreement"
  | "unknown";

export interface DiplomacyRow {
  kingdom: string;
  house: string;
  dbref: string;
  state: DiploState;
  they_offer: string | null;
}

export interface VassalRow {
  house: string;
  province: string;
  province_dbref: string;
  region: string | null;
  is_rey: boolean;
  at_war_with: string[];
  exempt: Record<string, boolean>;
}

export interface DiplomacyState {
  kingdom: { key: string; house: string; dbref: string };
  states: DiplomacyRow[];
  vassals: VassalRow[];
}

export interface KingdomHierarchy {
  ok: boolean;
  kingdom: string;
  house: string;
  vassals: VassalRow[];
  report?: string;
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
  item: string;
  nombre: string;
  price: number;
  available: number;
  tradeable?: boolean | null; // t16: diplomacia permite comerciar con esa casa
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

// t17: pedido en ruta (caravana) con su ETA
export interface CaravanOrder {
  id: string;
  as: "vendedor" | "comprador";
  item: string;
  nombre: string;
  qty: number;
  cost: number;
  buyer_house: string;
  seller_house: string;
  depart_day: number;
  arrive_day: number;
  days_left: number;
  cells: number;
  local: boolean;
  carts?: number;
  serfs?: number;
  weight_kg?: number;
}

export interface CommerceState {
  house: string;
  prices: Record<string, number>;
  cofre: CommerceCofre[];
  catalog: CommerceListing[];
  incoming: CommerceRequest[];
  outgoing: CommerceRequest[];
  caravans: CaravanOrder[];
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

export interface MapCampInfo {
  q: number;
  r: number;
  key: string;
  house: string | null;
  count: number;
  power: number;
  moral: number | null;
  ropa_ciclo: number;
  prisoners: number;
}

export interface MapState {
  width: number;
  height: number;
  rows: string[]; // símbolo de bioma por casilla (ancho x alto)
  zones: string[]; // zona climática por fila (solo depende de la latitud)
  oasis: [number, number][]; // casillas con oasis
  regions: MapRegionInfo[]; // regiones materializadas (caminadas/exploradas)
  camps?: MapCampInfo[]; // campamentos por región (plan 2I)
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
  drx?: number;
  quote?: FundQuote;
}

// ---------------------------------------------------------------------------
// Nexus (Hito 5): amistades + conversaciones
// ---------------------------------------------------------------------------
export interface NexusFriend {
  account_id: number;
  house: string;
}

export interface NexusThread {
  account_id: number;
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

export interface NexusSearchResult {
  account_id: number;
  house: string;
  is_friend: boolean;
  requested_by_them: boolean;
  requested_by_you: boolean;
}

export interface NexusSummary {
  threads: NexusThread[];
  friends: NexusFriend[];
  requests_in: NexusFriend[];
  requests_out: NexusFriend[];
  counts: Record<string, number>;
}

export interface NexusThreadView {
  with_account: number;
  with_house: string;
  is_friend: boolean;
  messages: NexusMessage[];
}

// ---------------------------------------------------------------------------
// Perfil de casa (t05): rol político SIN exponer el nombre del jugador
// ---------------------------------------------------------------------------
export interface HouseProfile {
  ok: boolean;
  has_house: boolean;
  house: string | null;
  display?: string;
  title?: string | null;
  title_label?: string | null;
  is_king?: boolean;
  regions_governed?: number;
  provinces?: { name: string; vassal: boolean }[];
  overlord?: string | null;
  king_house?: string | null;
  member_count?: number;
  is_friend?: boolean;
  account_id?: number;
  error?: string;
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
// Agricultura feudal (Hito 5/6): feudos propios y administrados + jornaleros
// ---------------------------------------------------------------------------
export interface FiefStock {
  item: string;
  name: string;
  amount: number;
}

export interface FiefCrop {
  crop: string;
  crop_name: string;
  ha: number;
  ready: boolean;
  days_left: number;
  perennial: boolean;
}

/** Composición del hato por especie (sexos/edades/gestantes), ver fiefs.hato_brief. */
export interface HerdSpecies {
  species: string;
  name: string;
  ugm_each: number;
  heads: number;
  female: number;
  male: number;
  juveniles: number;
  gestantes: number;
  adultas: number;
}

export interface HerdInfo {
  ugm: number;
  ugm_cap: number;
  heads_total: number;
  species: Record<string, HerdSpecies>;
}

/** Minas/extractivos del feudo (ver fiefs.extractive_brief). */
export interface ExtractiveInfo {
  type: string;
  name: string;
  level: number;
  resource: string;
  per_day_full: number;
  reserve_remaining: number | null;
  unlimited: boolean;
  labor_per_level: number;
}

export interface FiefView {
  coords: string;
  fx: number;
  fy: number;
  biome: string;
  fertility: number;
  arable: number;
  vegetation_pct?: number;
  ha_cleared?: number;
  ha_forestable?: number;
  ha_pending?: number;
  herd_ugm: number;
  herd?: HerdInfo;
  extractive?: ExtractiveInfo[];
  mineral_reservas?: Record<string, number>;
  crop: FiefCrop | null;
  stock: FiefStock[];
  role: "owner" | "admin";
  overlord: string | null;
  harvest_tax_pct: number | null;
}

export interface FiefsState {
  province: string;
  province_dbref: string;
  house: string | null;
  game_day: number;
  fiefs: FiefView[];
  is_senor: boolean;
  harvest_tax_pct: number;
}

export interface LaborState {
  house: string | null;
  jornaleros: number;
  max: number;
  daily_grain_need: number;
  cofre_cereal: number;
  hire_cost: number;
  pay_min: number;
  current_year: number;
  last_pay_year: number | null;
  unpaid_this_year: boolean;
  short_feed: boolean;
  coins: number;
}

export interface CropOption {
  id: string;
  name: string;
  days: number | null;
  type: string | null;
}

export type CropsByBiome = Record<string, CropOption[]>;

// ---------------------------------------------------------------------------
// Produccion / edificios (t11): catalogo construible + construir/mejorar/
// asignar trabajadores / elegir la salida de un taller.
// ---------------------------------------------------------------------------
export interface BuildingOutput {
  item: string;
  name: string;
  insumos: Record<string, string>;
  insumo_qty: Record<string, number>;
  salida: number;
  dias: number;
  nivel: number;
}

export interface BuildingCatalogEntry {
  type: string;
  name: string;
  cost: number[]; // [madera, piedra, cal, hierro]
  scale: number;
  max_level: number;
  requires: string;
  citadel_only: boolean;
  outputs: BuildingOutput[];
}

export interface BuildingLevel {
  type: string;
  name: string;
  level: number;
}

export interface BuildingFief {
  coords: string;
  fx: number;
  fy: number;
  biome: string;
  is_capital: boolean;
  role?: "owner" | "admin" | "capital";
  buildings: BuildingLevel[];
  workers: number;
  receta: Record<string, string[]>;
}

export interface BuildingsState {
  province: string;
  province_dbref: string;
  house: string | null;
  catalog: BuildingCatalogEntry[];
  fiefs: BuildingFief[];
  cofre: { drariux: number; goods: TreasuryGood[] };
}

// ---------------------------------------------------------------------------
// Notificaciones (feed de eventos de la propia casa/familia)
// ---------------------------------------------------------------------------
export type NotificationKind =
  | "familia"
  | "servidumbre"
  | "gobierno"
  | "economia"
  | "militar"
  | "alerta";

export interface NotificationItem {
  id: number;
  text: string;
  kind: NotificationKind | string;
  day: number;
  unread: boolean;
}

export interface NotificationsState {
  counts: { total: number; unread: number; limit: number };
  notifications: NotificationItem[];
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
  diplomacy: () => request<DiplomacyState>("/api/diplomacy/"),
  kingdomHierarchy: () => request<KingdomHierarchy>("/api/kingdom/hierarchy/"),
  news: () => request<unknown>("/api/news/"),
  map: () => request<MapState>("/api/map/"),
  commerce: () => request<CommerceState>("/api/commerce/"),
  population: () => request<PopulationCensus>("/api/population/"),
  fiefs: (province?: string) =>
    request<FiefsState>(
      `/api/fiefs/${province ? `?province=${encodeURIComponent(province)}` : ""}`,
    ),
  labor: () => request<LaborState>("/api/labor/"),
  crops: () => request<{ by_biome: CropsByBiome }>("/api/crops/"),
  buildings: (province?: string) =>
    request<BuildingsState>(
      `/api/buildings/${province ? `?province=${encodeURIComponent(province)}` : ""}`,
    ),
  nexus: () => request<NexusSummary>("/api/nexus/"),
  notifications: () => request<NotificationsState>("/api/notifications/"),
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
    request<
      ActionResult & {
        error?: string;
        result?: BattleResult;
        targets?: CampView[];
      }
    >("/api/army/action/", { method: "POST", body: JSON.stringify(body) }),
  kingdomAction: (body: Record<string, unknown>) =>
    request<ActionResult>("/api/kingdom/action/", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  diplomacyAction: (body: Record<string, unknown>) =>
    request<ActionResult & { error?: string; states?: DiplomacyRow[] }>(
      "/api/diplomacy/",
      { method: "POST", body: JSON.stringify(body) },
    ),
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
  fiefAction: (body: Record<string, unknown>) =>
    request<
      ActionResult & { harvested?: number; fief?: FiefView; fertility?: number; error?: string }
    >("/api/fief/action/", { method: "POST", body: JSON.stringify(body) }),
  laborAction: (body: Record<string, unknown>) =>
    request<ActionResult>("/api/labor/action/", { method: "POST", body: JSON.stringify(body) }),
  buildingAction: (body: Record<string, unknown>) =>
    request<
      ActionResult & {
        error?: string;
        buildings?: BuildingLevel[];
        workers?: number;
        receta?: Record<string, string[]>;
      }
    >("/api/building/action/", { method: "POST", body: JSON.stringify(body) }),
  notificationsAction: (body: Record<string, unknown>) =>
    request<ActionResult & { counts?: NotificationsState["counts"]; marked?: number }>(
      "/api/notifications/",
      { method: "POST", body: JSON.stringify(body) },
    ),
  harvestTaxAction: (pct: number, province?: string) =>
    request<ActionResult & { harvest_tax_pct?: number; error?: string }>("/api/tax/harvest/", {
      method: "POST",
      body: JSON.stringify({ pct, province }),
    }),
  nexusAction: (body: Record<string, unknown>) =>
    request<ActionResult & { error?: string; friends?: NexusFriend[]; to_house?: string }>(
      "/api/nexus/",
      { method: "POST", body: JSON.stringify(body) },
    ),
    nexusSearch: (q: string) =>
    request<{ results: NexusSearchResult[] }>("/api/nexus/", {
      method: "POST",
      body: JSON.stringify({ action: "search", q }),
    }),
  houseProfile: (accountId: number | string) =>
    request<HouseProfile>(
      `/api/house/profile/?account=${encodeURIComponent(String(accountId))}`,
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
      opts: {
        email?: string;
        house?: string;
        vassalCode?: string;
        startChoice?: "gobernador" | "vasallo" | "administrador";
        sex?: "hombre" | "mujer";
      } = {},
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
            start_choice: opts.startChoice ?? "",
            sex: opts.sex ?? "",
          }),
        },
      ),
    logout: () => request<{ ok: boolean }>("/api/auth/logout/", { method: "POST" }),
  },
};
