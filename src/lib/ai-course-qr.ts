import "server-only";
import QRCode from "qrcode";
import { AI_COURSE_URL } from "./ai-course";

export async function createAiCourseQrDataUrl(): Promise<string> {
  return QRCode.toDataURL(AI_COURSE_URL, { width: 1024, margin: 4, errorCorrectionLevel: "M", type: "image/png" });
}
