/**
 * Configuración de la app. La base URL del motor y los parámetros de la cadena
 * viven AQUÍ (no sensibles). Las claves privadas del jugador nunca tocan el
 * servidor: se generan en el cliente (viem) y se cifran en el keystore local.
 */
export const CONFIG = {
  // Motor Evennia: en Android apunta al VPS; en web/dev usa el proxy de Vite.
  apiBaseUrl:
    import.meta.env.VITE_API_BASE_URL ??
    (import.meta.env.DEV ? "" : "https://civitas.drariux.network/api"),

  // Parámetros públicos de la cadena drariux (Evmos/Ethermint compatible EVM).
  chain: {
    name: "drariux",
    nativeDenom: import.meta.env.VITE_NATIVE_DENOM ?? "drariux",
    displaySymbol: "DRARIUX",
    evmChainId: Number(import.meta.env.VITE_CHAIN_ID ?? 9854),
    decimals: 18,
  },
} as const;

export function apiUrl(path: string): string {
  const base = CONFIG.apiBaseUrl.replace(/\/$/, "");
  const clean = path.startsWith("/") ? path : `/${path}`;
  // En dev, base vacío => el proxy de Vite sirve /api/*.
  return `${base}${clean}`;
}
