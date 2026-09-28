import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.civitas.app",
  appName: "Civitas",
  webDir: "dist",
  // La app deriva estados en cliente y solo pide lo mínimo al motor.
  server: {
    androidScheme: "https",
  },
  plugins: {
    // En Android, enruta fetch/XHR por la pila de red NATIVA (OkHttp) en vez del
    // WebView. Evita los caprichos propios del WebView (CORS cross-origin desde
    // https://localhost, bloqueo de User-Agent '; wv' por Cloudflare, ruteo IPv6
    // roto) que provocaban "no se pudo conectar" solo en el teléfono.
    CapacitorHttp: { enabled: true },
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
