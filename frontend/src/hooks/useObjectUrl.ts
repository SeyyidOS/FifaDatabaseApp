import { useEffect, useState } from "react";

/** An object URL for a Blob or File, revoked when it is no longer shown. */
export function useObjectUrl(blob: Blob | undefined) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => {
      URL.revokeObjectURL(u);
      setUrl(undefined);
    };
  }, [blob]);
  return url;
}
