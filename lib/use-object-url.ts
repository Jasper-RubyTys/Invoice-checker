import { useEffect, useMemo } from "react";

/**
 * Object URLs must be revoked or they leak memory for the lifetime of the
 * page. This creates one for `file` and revokes the previous URL whenever
 * `file` changes or the component unmounts.
 */
export function useObjectUrl(file: File | null): string | null {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  return url;
}
