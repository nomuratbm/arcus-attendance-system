"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import QrScanner from "qr-scanner";
import {
  memberFromDynamoItem,
  useAttendanceStore,
} from "@/store/useAttendanceStore";
import { useEventsStore } from "@/store/useEventsStore";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function QRScanner() {
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerMode, setScannerMode] = useState<"camera" | "file">("camera");
  const [loading, setLoading] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { setCurrentMember, addAttendanceRecord, setScanStatus, setAlert } = useAttendanceStore();
  const selectedEventPK = useEventsStore((state) => state.selectedEventPK);
  const canScan = Boolean(selectedEventPK);

  const processScannedUuid = useCallback(
    async (scannedText: string) => {
      console.log("Scanned text from QR:", scannedText);
      const trimmedUuid = scannedText.trim();
      if (!trimmedUuid) return;

      if (!useEventsStore.getState().selectedEventPK) {
        setScanStatus("error");
        setAlert("error", "Select an event before scanning");
        return;
      }

      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      // freeze camera frame on capture
      try {
        if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
          html5QrcodeRef.current.pause(true);
          setIsFrozen(true);
        }
      } catch {
        // ignore
      }

      setLoading(true);
      setScanStatus("loading");
      setAlert(null, null);

      try {
        const response = await fetch(`/api/member?uuid=${encodeURIComponent(trimmedUuid)}`);
        const data = await response.json();

        if (
          response.ok &&
          data.valid &&
          data.member &&
          typeof data.member === "object"
        ) {
          const member = memberFromDynamoItem(
            data.member as Record<string, unknown>,
            trimmedUuid,
          );
          setCurrentMember(member);

          const memberSK = member.SK || member.PK;
          const alreadyCheckedIn = useAttendanceStore
            .getState()
            .attendanceHistory.some((item) => item.SK === memberSK);

          if (alreadyCheckedIn) {
            setScanStatus("success");
            setAlert(
              "info",
              `Already checked in: ${member.full_name || "Member Found"}`,
            );
            return;
          }

          const record = addAttendanceRecord(member);
          if (!record) {
            setScanStatus("error");
            setAlert("error", "Select an event before scanning");
          } else {
            setScanStatus("success");
            setAlert(
              "success",
              `Checked in: ${member.full_name || "Member Found"}`,
            );
            const rawEventId = record.PK.replace(/^EVENT#/, "");
            const rawMemberUuid = (record.SK || member.PK).replace(/^MEMBER#/, "");
            void fetch("/api/checkin", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                eventId: rawEventId,
                uuid: rawMemberUuid,
                scannedAt: record.scannedAt,
                timestamp: record.timestamp,
              }),
            })
              .then(async (checkInResponse) => {
                if (checkInResponse.ok || checkInResponse.status === 409) {
                  return;
                }
                console.error(
                  "Check-in persist error:",
                  await checkInResponse.text(),
                );
              })
              .catch((err) => {
                console.error("Check-in persist error:", err);
              });
          }
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
        // keep frame frozen briefly to view result, then resume live scanning
        setTimeout(() => {
          try {
            if (html5QrcodeRef.current && html5QrcodeRef.current.getState() === 3) {
              html5QrcodeRef.current.resume();
            }
          } catch {
            // ignore
          }
          setIsFrozen(false);
          isProcessingRef.current = false;
        }, 1500);
      }
    },
    [setCurrentMember, addAttendanceRecord, setScanStatus, setAlert]
  );

  const startCamera = async () => {
    if (!useEventsStore.getState().selectedEventPK) {
      setScanStatus("error");
      setAlert("error", "Select an event before scanning");
      return;
    }

    try {
      await stopCamera();
      await new Promise((r) => setTimeout(r, 100));

      const readerEl = document.getElementById("reader");
      if (!readerEl) {
        setAlert("error", "Scanner container not found.");
        return;
      }
      readerEl.innerHTML = "";

      const html5Qrcode = new Html5Qrcode("reader", {
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
        verbose: false,
      });
      html5QrcodeRef.current = html5Qrcode;

      await html5Qrcode.start(
        { facingMode: "environment" },
        {
          fps: 25,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const qrboxSize = Math.floor(minEdge * 0.88);
            return { width: qrboxSize, height: qrboxSize };
          },
        },
        (decodedText) => {
          processScannedUuid(decodedText);
        },
        () => {}
      );
      setScannerActive(true);
      setIsFrozen(false);
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
    setIsFrozen(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!useEventsStore.getState().selectedEventPK) {
      setScanStatus("error");
      setAlert("error", "Select an event before scanning");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

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
    try {
      if (html5QrcodeRef.current && html5QrcodeRef.current.getState() === 3) {
        html5QrcodeRef.current.resume();
      }
    } catch {
      // ignore
    }
    setIsFrozen(false);
    isProcessingRef.current = false;
  };

  useEffect(() => {
    if (!canScan && scannerActive) {
      void stopCamera();
    }
  }, [canScan, scannerActive]);

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
                disabled={!canScan}
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
                disabled={!canScan}
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
          <div className="relative">
            <div
              id="reader"
              className="w-full rounded-md overflow-hidden bg-neutral-950"
              style={{
                minHeight: scannerMode === "camera" ? "250px" : "0px",
                display: scannerMode === "camera" ? "block" : "none",
              }}
            />
            {scannerMode === "camera" && scannerActive && isFrozen && (
              <div className="absolute top-2 right-2 z-10 bg-black/75 text-white text-[10px] font-mono px-2 py-0.5 rounded backdrop-blur-xs">
                Captured ✓
              </div>
            )}
          </div>

          {/* camera off placeholder */}
          {scannerMode === "camera" && !scannerActive && (
            <div className="py-14 text-center bg-muted/40 border border-dashed rounded-md text-muted-foreground text-xs">
              {canScan ? (
                <>
                  <p>Camera is currently inactive</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-1">
                    Click &apos;Start Camera&apos; to begin scanning
                  </p>
                </>
              ) : (
                <>
                  <p>Select an event to start scanning</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-1">
                    Camera scanning is disabled until an active event is chosen
                  </p>
                </>
              )}
            </div>
          )}

          {scannerMode === "file" && (
            <div className="flex flex-col items-center justify-center py-10 px-4 bg-muted/20 text-center border border-dashed rounded-md">
              <span className="text-sm font-medium text-foreground mb-4">
                {!canScan
                  ? "Select an event to upload a QR code"
                  : loading
                    ? "Reading image..."
                    : "Select your QR code image"}
              </span>
              <Button
                disabled={!canScan || loading}
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                disabled={!canScan}
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
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
              disabled={loading || (!scannerActive && !canScan)}
            >
              {loading ? "Verifying..." : scannerActive ? "Stop Camera" : "Start Camera"}
            </Button>
            {scannerActive && (
              <Button variant="outline" size="sm" onClick={resetScanner}>
                Resume
              </Button>
            )}
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={!canScan || loading}
            onClick={() => {
              if (!canScan) {
                return;
              }
              resetScanner();
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
                fileInputRef.current.click();
              }
            }}
          >
            Upload Another File
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
