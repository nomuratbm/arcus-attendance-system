"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import QrScanner from "qr-scanner";
import { useAttendanceStore } from "@/store/useAttendanceStore";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function QRScanner() {
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerMode, setScannerMode] = useState<"camera" | "file">("camera");
  const [loading, setLoading] = useState(false);
  const [lastScannedUuid, setLastScannedUuid] = useState<string | null>(null);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { setCurrentMember, addAttendanceRecord, setScanStatus, setAlert } = useAttendanceStore();

  const processScannedUuid = useCallback(
    async (scannedText: string) => {
      const trimmedUuid = scannedText.trim();
      if (!trimmedUuid) return;

      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setLastScannedUuid(trimmedUuid);

      setLoading(true);
      setScanStatus("loading");
      setAlert(null, null);

      try {
        const response = await fetch(`/api/member?uuid=${encodeURIComponent(trimmedUuid)}`);
        const data = await response.json();

        if (response.ok && data.valid && data.member) {
          setCurrentMember(data.member);
          addAttendanceRecord(data.member);
          setScanStatus("success");
          setAlert(
            "success",
            `Checked in: ${data.member.full_name || data.member.fullName || "Member Found"}`
          );
        } else {
          setCurrentMember(null);
          setScanStatus("error");
          setAlert("error", data.error || "Student not found in registry");
        }
      } catch (error) {
        console.error("Scan API Request Error:", error);
        setCurrentMember(null);
        setScanStatus("error");
        setAlert("error", "Network error connecting to database");
      } finally {
        setLoading(false);
        setTimeout(() => {
          isProcessingRef.current = false;
        }, 1200);
      }
    },
    [setCurrentMember, addAttendanceRecord, setScanStatus, setAlert]
  );

  const startCamera = async () => {
    try {
      await stopCamera();
      await new Promise((r) => setTimeout(r, 100));

      const readerEl = document.getElementById("reader");
      if (!readerEl) {
        setAlert("error", "Scanner container not found.");
        return;
      }
      readerEl.innerHTML = "";

      const html5Qrcode = new Html5Qrcode("reader");
      html5QrcodeRef.current = html5Qrcode;

      await html5Qrcode.start(
        { facingMode: "environment" },
        { fps: 15, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          processScannedUuid(decodedText);
        },
        () => {}
      );
      setScannerActive(true);
    } catch (err) {
      console.error("Camera access error:", err);
      setAlert("error", "Camera access denied or unavailable.");
      setScannerActive(false);
    }
  };

  const stopCamera = async () => {
    try {
      if (html5QrcodeRef.current) {
        if (html5QrcodeRef.current.isScanning) {
          await html5QrcodeRef.current.stop();
        }
        html5QrcodeRef.current.clear();
        html5QrcodeRef.current = null;
      }
    } catch (e) {
      console.error("Error stopping camera:", e);
    }
    setScannerActive(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setScanStatus("loading");
    setAlert(null, null);

    try {
      const result = await QrScanner.scanImage(file, {
        returnDetailedScanResult: true,
        alsoTryWithoutScanRegion: true,
      });

      if (result && result.data) {
        await processScannedUuid(result.data);
      } else {
        throw new Error("No QR detected");
      }
    } catch (err) {
      console.error("Failed to decode QR image file:", err);
      setScanStatus("error");
      setAlert("error", "Could not read QR code from image.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const resetScanner = () => {
    setLastScannedUuid(null);
    isProcessingRef.current = false;
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <Card className="flex flex-col justify-between">
      <div>
        <CardHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Scan QR Code</CardTitle>
              <CardDescription className="text-xs">Camera stream or file upload</CardDescription>
            </div>
            <div className="flex gap-1">
              <Button
                variant={scannerMode === "camera" ? "default" : "ghost"}
                size="xs"
                onClick={() => {
                  stopCamera();
                  setScannerMode("camera");
                }}
              >
                Camera
              </Button>
              <Button
                variant={scannerMode === "file" ? "default" : "ghost"}
                size="xs"
                onClick={() => {
                  stopCamera();
                  setScannerMode("file");
                }}
              >
                Upload File
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {/* camera box */}
          <div
            id="reader"
            className="w-full rounded-md overflow-hidden bg-neutral-950"
            style={{
              minHeight: scannerMode === "camera" ? "250px" : "0px",
              display: scannerMode === "camera" ? "block" : "none",
            }}
          />

          {/* camera off placeholder */}
          {scannerMode === "camera" && !scannerActive && (
            <div className="py-14 text-center bg-muted/40 border border-dashed rounded-md text-muted-foreground text-xs">
              <p>Camera is currently inactive</p>
            </div>
          )}

          {/* upload dropzone */}
          {scannerMode === "file" && (
            <label className="flex flex-col items-center justify-center py-14 px-4 cursor-pointer bg-muted/40 hover:bg-muted/70 transition-colors text-center border border-dashed rounded-md">
              <span className="text-xs font-medium text-foreground">
                {loading ? "Reading image..." : "Click to select a QR code image"}
              </span>
              <span className="text-[11px] text-muted-foreground mt-1">
                Supports PNG, JPG, JPEG
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          )}
        </CardContent>
      </div>

      <CardFooter className="pt-0 flex gap-2">
        {scannerMode === "camera" ? (
          <>
            <Button
              className="flex-1"
              size="sm"
              variant={scannerActive ? "destructive" : "default"}
              onClick={scannerActive ? stopCamera : startCamera}
              disabled={loading}
            >
              {loading ? "Processing..." : scannerActive ? "Stop Camera" : "Start Camera"}
            </Button>
            {scannerActive && (
              <Button variant="outline" size="sm" onClick={resetScanner}>
                Reset
              </Button>
            )}
          </>
        ) : (
          <Button variant="outline" size="sm" className="w-full" onClick={resetScanner}>
            Upload Another File
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
