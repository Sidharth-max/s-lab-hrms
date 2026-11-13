import "server-only";
import { env } from "../env";
import { awsFace } from "./aws";
import { mockFace } from "./mock";

export type EnrollResult =
  | { ok: true; faceIds: string[] }
  | { ok: false; error: string };

export type SearchResult =
  | { ok: true; employeeId: string; similarity: number }
  | { ok: false; reason: "no_face" | "no_match" | "ambiguous" | "error"; message: string };

export type PoseResult =
  | { ok: true; yaw: number; pitch: number }
  /** no_face: nobody in the picture. unavailable: the check cannot run (test mode, or AWS permission missing). */
  | { ok: false; reason: "no_face" | "unavailable" };

export interface FaceProvider {
  name: "mock" | "aws";
  /** Enrolls one or more photos of the same person and replaces their earlier photos. */
  enroll(businessId: string, employeeId: string, images: Buffer[], previousFaceIds: string[]): Promise<EnrollResult>;
  /** mockEmployeeId is only honoured by the mock provider (test mode). */
  search(businessId: string, image: Buffer, mockEmployeeId?: string): Promise<SearchResult>;
  remove(businessId: string, faceIds: string[]): Promise<void>;
  /** Head direction in one photo (degrees), for the guided face scan. */
  pose(image: Buffer): Promise<PoseResult>;
}

export function faceProvider(): FaceProvider {
  return env.faceProvider === "aws" ? awsFace : mockFace;
}

/** All face ids stored for an employee (older rows only have faceId). */
export function storedFaceIds(e: { faceId: string | null; faceIds: string[] }): string[] {
  return [...new Set([...(e.faceIds ?? []), ...(e.faceId ? [e.faceId] : [])])];
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
