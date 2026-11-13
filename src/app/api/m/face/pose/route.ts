import { json, readJson, staff } from "@/lib/api";
import { decodeImage, faceProvider } from "@/lib/face";
import { judge, type GuideStep } from "@/lib/face/guide";

// Live face guide for enrolment. The app sends a frame every few hundred ms; this answers with the
// face's position (box), head pose (yaw / pitch / roll) and whether the current step is satisfied,
// plus a short instruction ("Move a little to the left", "Turn the other way", "Hold still").
// The app only keeps a photo after two satisfied frames in a row that are stable (see guide.ts).
const STEPS = new Set<GuideStep>(["straight", "side1", "side2", "vert1", "vert2"]);

export async function POST(req: Request) {
  return staff(async () => {
    const body = await readJson(req);
    const step = (STEPS.has(body.step as GuideStep) ? body.step : "straight") as GuideStep;
    const ref = Number(body.ref ?? 0);
    const image = decodeImage(body.image);
    if (!image) return json({ accept: false, verified: true, fix: "no_face", hint: "Camera picture not received. Hold still." });
    const pose = await faceProvider().pose(image);
    // Cannot verify (test mode, or the AWS DetectFaces permission is missing): tell the app, which
    // then falls back to a timed capture and says the live check is off.
    if (!pose.ok && pose.reason === "unavailable") return json({ accept: true, verified: false, sign: ref ? -ref : 1 });
    if (!pose.ok) return json({ accept: false, verified: true, fix: "no_face", hint: "Face not found. Look at the camera in good light.", face: null });
    const reading = { yaw: pose.yaw, pitch: pose.pitch, roll: pose.roll, box: pose.box, brightness: pose.brightness, faces: pose.faces };
    const j = judge(step, reading, ref);
    return json({ ...j, verified: true, face: reading });
  }, "employees.manage");
}
