import QRCode from "qrcode";

const qrCodeOptions = {
  type: "image/png" as const,
  margin: 2,
  scale: 8,
  color: {
    dark: "#000000",
    light: "#ffffff",
  },
};

export async function generateQrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload.trim(), qrCodeOptions);
}
