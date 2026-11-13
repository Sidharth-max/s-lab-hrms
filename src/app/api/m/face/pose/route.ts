import { json, readJson, staff } from "@/lib/api";
import { decodeImage, faceProvider } from "@/lib/face";

// Guided face scan: is the head in this frame turned the way the current step asks?
// Steps: straight, side1 (first turn, either side), side2 (the other side), vert1 (up or down), vert2 (the other).
// The first turn of a pair is accepted on either side and its direction is returned as `sign`;
// the second must be the opposite, so the check does not depend on camera mirroring.
const SIDE = 12; // degrees of yaw that count as "turned"
const VERT = 8; // degrees of pitch that count as "up / down"

export async function POST(req: Request) {
  return staff(async () => {
    const body = await readJson(req);
    const step = String(body.step ?? "straight");
    const ref = Number(body.ref ?? 0);
    const image = decodeImage(body.image);
    if (!image) return json({ accept: false, hint: "Camera picture not received. Hold still." });
    const pose = await faceProvider().pose(image);
    // Cannot verify (test mode or AWS permission missing): accept, so enrolment still works.
    if (!pose.ok && pose.reason === "unavailable") return json({ accept: true, verified: false, sign: ref ? -ref : 1 });
    if (!pose.ok) return json({ accept: false, hint: "Face not found. Come closer, in good light." });
    const { yaw, pitch } = pose;
    if (step === "straight") {
      const ok = Math.abs(yaw) < 10 && Math.abs(pitch) < 12;
      return json({ accept: ok, verified: true, hint: ok ? undefined : "Look straight at the camera" });
    }
    const value = step.startsWith("side") ? yaw : pitch;
    const need = step.startsWith("side") ? SIDE : VERT;
    const sign = Math.sign(value) || 1;
    if (Math.abs(value) < need) return json({ accept: false, verified: true, hint: "A little more" });
    if (step.endsWith("2") && ref && sign === ref) return json({ accept: false, verified: true, hint: "The other way" });
    return json({ accept: true, verified: true, sign });
  }, "employees.manage");
}
