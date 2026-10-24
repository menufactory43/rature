import type { CapacitorConfig } from "@capacitor/cli";

/**
 * L'app iPhone de Rature (Capacitor) : le même jeu que la page publiée, embarqué hors ligne (dist/, construit par
 * `npm run build`). `npm run ios` construit, copie dans ios/ et ouvre Xcode.
 */
const config: CapacitorConfig = {
  appId: "com.meffysto.rature.ios",
  appName: "Rature",
  webDir: "dist",
  backgroundColor: "#8a5a32",
  ios: {
    // le jeu se place lui-même à l'abri de l'encoche (viewport-fit=cover, env(safe-area-inset-*))
    contentInset: "never",
    scrollEnabled: false,
    allowsLinkPreview: false,
  },
  plugins: {
    SplashScreen: { launchShowDuration: 0, backgroundColor: "#8a5a32" },
  },
};

export default config;
