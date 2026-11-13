import "server-only";
import {
  CreateCollectionCommand,
  DeleteFacesCommand,
  DetectFacesCommand,
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

  async enroll(businessId, employeeId, images, previousFaceIds) {
    const CollectionId = await ensureCollection(businessId);
    const added: string[] = [];
    const ownOld = new Set(previousFaceIds);
    const undo = async () => {
      if (added.length) await rekognition().send(new DeleteFacesCommand({ CollectionId, FaceIds: added })).catch(() => {});
    };
    try {
      for (const [i, image] of images.entries()) {
        const label = images.length > 1 ? `Photo ${i + 1}: ` : "";
        // Refuse if this face already belongs to someone else.
        let matches: Awaited<ReturnType<typeof searchRaw>> = [];
        try {
          matches = await searchRaw(businessId, image);
        } catch (e) {
          if (errName(e) === "InvalidParameterException") {
            if (i > 0) continue; // a side / up / down photo without a clear face is simply left out
            await undo();
            return { ok: false, error: `${label}No clear face found. Look at the camera in good light.` };
          }
          throw e;
        }
        if (matches.some((m) => m.employeeId !== employeeId)) {
          await undo();
          return { ok: false, error: `${label}This face is already enrolled for another employee.` };
        }
        for (const m of matches) if (!added.includes(m.faceId)) ownOld.add(m.faceId);

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
        if (!faceId) {
          if (i > 0) continue; // extra angles are best-effort; the straight photo is the one that must be good
          await undo();
          return { ok: false, error: `${label}Face quality too low. Use good light, remove mask or cap, and retry.` };
        }
        added.push(faceId);
      }
      // The new photos replace all earlier photos of this person.
      const stale = [...ownOld].filter((f) => !added.includes(f) && !f.startsWith("mock-"));
      if (stale.length) await rekognition().send(new DeleteFacesCommand({ CollectionId, FaceIds: stale }));
      return { ok: true, faceIds: added };
    } catch (e) {
      console.error("Face enroll failed", e);
      await undo();
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

  async pose(image) {
    try {
      const res = await rekognition().send(new DetectFacesCommand({ Image: { Bytes: image }, Attributes: ["DEFAULT"] }));
      // The largest face is the person being enrolled.
      const face = (res.FaceDetails ?? []).sort((a, b) => (b.BoundingBox?.Width ?? 0) * (b.BoundingBox?.Height ?? 0) - (a.BoundingBox?.Width ?? 0) * (a.BoundingBox?.Height ?? 0))[0];
      if (!face?.Pose) return { ok: false, reason: "no_face" };
      return { ok: true, yaw: face.Pose.Yaw ?? 0, pitch: face.Pose.Pitch ?? 0 };
    } catch (e) {
      if (errName(e) === "InvalidParameterException" || errName(e) === "InvalidImageFormatException") return { ok: false, reason: "no_face" };
      // e.g. AccessDeniedException when rekognition:DetectFaces is not in the IAM policy yet.
      console.error("Face pose check unavailable", errName(e));
      return { ok: false, reason: "unavailable" };
    }
  },

  async remove(businessId, faceIds) {
    const real = faceIds.filter((f) => !f.startsWith("mock-"));
    if (real.length) await rekognition().send(new DeleteFacesCommand({ CollectionId: collectionId(businessId), FaceIds: real }));
  },
};
