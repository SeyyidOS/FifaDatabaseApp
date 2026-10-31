import { Toaster } from "sonner";
import { useTheme } from "../../hooks/useTheme";

export function ThemedToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      position="top-center"
      theme={theme}
      // below the notch where the page runs under it (index.css, --safe-top)
      offset={{ top: "calc(var(--safe-top) + 20px)" }}
      mobileOffset={{ top: "calc(var(--safe-top) + 12px)" }}
      toastOptions={{
        classNames: {
          toast: "!rounded-2xl !border !border-line !bg-surface !text-fg !shadow-2xl !font-sans",
          description: "!text-muted",
        },
      }}
    />
  );
}
