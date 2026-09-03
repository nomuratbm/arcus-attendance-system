"use client";

import { useCallback, useState } from "react";

export function useQrCode() {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (payload: string) => {
    const value = payload.trim();
    if (!value) {
      setDataUrl(null);
      setError(null);
      return null;
    }

    setGenerating(true);
    setError(null);

    try {
      const { generateQrDataUrl } = await import("@/lib/qr-code");
      const url = await generateQrDataUrl(value);
      setDataUrl(url);
      return url;
    } catch {
      setDataUrl(null);
      setError("Could not generate QR code.");
      return null;
    } finally {
      setGenerating(false);
    }
  }, []);

  const clear = useCallback(() => {
    setDataUrl(null);
    setError(null);
  }, []);

  return { dataUrl, generating, error, generate, clear };
}
