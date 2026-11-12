import "server-only";
import {
  CreateCollectionCommand,
  DeleteFacesCommand,
  IndexFacesCommand,
  RekognitionClient,
  SearchFacesByImageCommand,
} from "@aws-sdk/client-rekognition";
import { env } from "../env";
import type { FaceProvider } from "./index";

let client: RekognitionClient | null = null;
export function rekognition(): RekognitionClient {
  // Credentials come from the standard AWS environment variables / instance role.
  client ??= new RekognitionClient({ region: env.awsRegion });
  return client;
}

/** One collection per business, so faces are never searched across businesses. */
export function collectionId(businessId: string) {
  return `hrms-${businessId}`;
}

const ensured = new Set<string>();
async function ensureCollection(businessId: string) {
  const id = collectionId(businessId);
  if (ensured.has(id)) return id;
  try {
    await rekognition().send(new CreateCollectionCommand({ CollectionId: id }));
  } catch (e) {
    if ((e as { name?: string }).name !== "ResourceAlreadyExistsException") throw e;
  }
  ensured.add(id);
  return id;
}

function errName(e: unknown) {
  return (e as { name?: string }).name ?? "Error";
}

async function searchRaw(businessId: string, image: Buffer) {
  const CollectionId = await ensureCollection(businessId);
  const res = await rekognition().send(
    new SearchFacesByImageCommand({
      CollectionId,
      Image: { Bytes: image },
      FaceMatchThreshold: env.faceMatchThreshold,
      MaxFaces: 3,
      QualityFilter: "AUTO",
    }),
  );
  return (res.FaceMatches ?? [])
    .filter((m) => m.Face?.ExternalImageId && m.Similarity != null)
    .map((m) => ({ employeeId: m.Face!.ExternalImageId!, faceId: m.Face!.FaceId!, similarity: m.Similarity! }));
}

export const awsFace: FaceProvider = {
  name: "aws",

  async enroll(businessId, employeeId, image, previousFaceId) {
    try {
      // Refuse if this face already belongs to someone else.
      let matches: Awaited<ReturnType<typeof searchRaw>> = [];
      try {
        matches = await searchRaw(businessId, image);
      } catch (e) {
        if (errName(e) === "InvalidParameterException") return { ok: false, error: "No clear face found. Look straight at the camera in good light." };
        throw e;
      }
      const other = matches.find((m) => m.employeeId !== employeeId);
      if (other) return { ok: false, error: "This face is already enrolled for another employee." };

      const CollectionId = await ensureCollection(businessId);
      const res = await rekognition().send(
        new IndexFacesCommand({
          CollectionId,
          Image: { Bytes: image },
          ExternalImageId: employeeId,
          MaxFaces: 1,
          QualityFilter: "HIGH",
          DetectionAttributes: [],
        }),
      );
      const faceId = res.FaceRecords?.[0]?.Face?.FaceId;
      if (!faceId) return { ok: false, error: "Face quality too low. Use good light, remove mask or cap, and retry." };

      const stale = [previousFaceId, ...matches.filter((m) => m.employeeId === employeeId).map((m) => m.faceId)].filter(
        (f): f is string => !!f && f !== faceId,
      );
      if (stale.length) await rekognition().send(new DeleteFacesCommand({ CollectionId, FaceIds: stale }));
      return { ok: true, faceId };
    } catch (e) {
      console.error("Face enroll failed", e);
      return { ok: false, error: "Face service error. Try again." };
    }
  },

  async search(businessId, image) {
    try {
      const matches = await searchRaw(businessId, image);
      if (matches.length === 0) return { ok: false, reason: "no_match", message: "Face not recognised" };
      const [best, second] = matches;
      if (second && second.employeeId !== best.employeeId) {
        return { ok: false, reason: "ambiguous", message: "Face matched more than one person" };
      }
      return { ok: true, employeeId: best.employeeId, similarity: best.similarity };
    } catch (e) {
      if (errName(e) === "InvalidParameterException") return { ok: false, reason: "no_face", message: "No face found" };
      console.error("Face search failed", e);
      return { ok: false, reason: "error", message: "Face service error" };
    }
  },

  async remove(businessId, faceId) {
    if (faceId.startsWith("mock-")) return;
    await rekognition().send(new DeleteFacesCommand({ CollectionId: collectionId(businessId), FaceIds: [faceId] }));
  },
};
