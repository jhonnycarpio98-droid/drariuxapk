import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.civitas.app",
  appName: "Civitas",
  webDir: "dist",
  // La app deriva estados en cliente y solo pide lo mínimo al motor.
  server: {
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
