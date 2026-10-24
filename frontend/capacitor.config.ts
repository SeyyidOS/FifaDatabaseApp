import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The iPhone app: the same web app, built as the store edition (`npm run build:app`, .env.app) and
 * shipped inside a native shell (ios/). It talks to the live API by its full address.
 */
const config: CapacitorConfig = {
  appId: "com.hotspotkeeper.matchnight",
  appName: "Matchnight",
  webDir: "dist",
  ios: {
    // the page itself handles the notch and the home bar (viewport-fit=cover, safe-area insets)
    contentInset: "never",
    backgroundColor: "#06080d",
  },
};

export default config;
