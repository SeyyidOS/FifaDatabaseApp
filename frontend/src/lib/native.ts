import { Capacitor } from "@capacitor/core";
import { Haptics, NotificationType } from "@capacitor/haptics";
import { Share } from "@capacitor/share";
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

/**
 * Hands a link over: the phone's own share sheet in the iPhone app, the browser's where there is one,
 * else the clipboard ("copied", for the caller to say so).
 */
export async function shareLink(url: string, text: string): Promise<"shared" | "copied" | "cancelled"> {
  if (NATIVE) {
    try {
      await Share.share({ text, url });
      return "shared";
    } catch {
      // closing the sheet rejects too
      return "cancelled";
    }
  }
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text, url });
      return "shared";
    } catch (err) {
      if ((err as Error).name === "AbortError") return "cancelled";
    }
  }
  await navigator.clipboard.writeText(url);
  return "copied";
}

/** A short "done" tap in the hand, in the iPhone app (a result saved). */
export function hapticSuccess() {
  if (!NATIVE) return;
  Haptics.notification({ type: NotificationType.Success }).catch(() => {
    /* an older shell without the plugin */
  });
}
