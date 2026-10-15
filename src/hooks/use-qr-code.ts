"use client";

import { useCallback, useRef, useState } from "react";

export function useQrCode() {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);

  const generate = useCallback(async (payload: string, signal?: AbortSignal) => {
    const value = payload.trim();
    if (!value) {
      setDataUrl(null);
      setError(null);
      return null;
    }

    const id = ++requestId.current;
    const stale = () => signal?.aborted || requestId.current !== id;

    setGenerating(true);
    setError(null);

    try {
      const { generateQrDataUrl } = await import("@/lib/qr-code");
      const url = await generateQrDataUrl(value);
      if (stale()) return null;
      setDataUrl(url);
      return url;
    } catch {
      if (stale()) return null;
      setDataUrl(null);
      setError("Could not generate QR code.");
      return null;
    } finally {
      if (!stale()) setGenerating(false);
    }
  }, []);

  const clear = useCallback(() => {
    setDataUrl(null);
    setError(null);
  }, []);

  return { dataUrl, generating, error, generate, clear };
}
