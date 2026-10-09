import { Toaster } from "sonner";
import { useTheme } from "../../hooks/useTheme";

export function ThemedToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      position="top-center"
      theme={theme}
      offset={20}
      toastOptions={{
        classNames: {
          toast: "!rounded-2xl !border !border-line !bg-surface !text-fg !shadow-2xl !font-sans",
          description: "!text-muted",
        },
      }}
    />
  );
}
