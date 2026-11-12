import "server-only";
import { env } from "../env";
import { awsFace } from "./aws";
import { mockFace } from "./mock";

export type EnrollResult =
  | { ok: true; faceId: string }
  | { ok: false; error: string };

export type SearchResult =
  | { ok: true; employeeId: string; similarity: number }
  | { ok: false; reason: "no_face" | "no_match" | "ambiguous" | "error"; message: string };

export interface FaceProvider {
  name: "mock" | "aws";
  enroll(businessId: string, employeeId: string, image: Buffer, previousFaceId: string | null): Promise<EnrollResult>;
  /** mockEmployeeId is only honoured by the mock provider (test mode). */
  search(businessId: string, image: Buffer, mockEmployeeId?: string): Promise<SearchResult>;
  remove(businessId: string, faceId: string): Promise<void>;
}

export function faceProvider(): FaceProvider {
  return env.faceProvider === "aws" ? awsFace : mockFace;
}

export function decodeImage(dataUrl: unknown): Buffer | null {
  if (typeof dataUrl !== "string") return null;
  const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  const buf = Buffer.from(m[2], "base64");
  // Rekognition accepts up to 5 MB of image bytes.
  if (buf.length < 1000 || buf.length > 5 * 1024 * 1024) return null;
  return buf;
}
