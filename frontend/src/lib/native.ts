import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

/** Running inside the iPhone app (capacitor.config.ts), not a browser. */
export const NATIVE = Capacitor.isNativePlatform();

/** The status bar's text follows the theme: light on the dark theme, dark on the light one. */
export function syncStatusBar(theme: "dark" | "light") {
  if (!NATIVE) return;
  StatusBar.setStyle({ style: theme === "dark" ? Style.Dark : Style.Light }).catch(() => {
    /* an older shell without the plugin: the default stays */
  });
}
