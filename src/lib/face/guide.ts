import type { FaceBox } from "./index";

// Guided face enrolment: is the face in this frame where the current step needs it?
// Pure logic (no AWS), shared by the app and the website and covered by unit tests.
//
// Steps: straight, side1, side2, vert1, vert2. The app shows them as
// "Look straight", "Turn left", "Turn right", "Look up", "Look down".
// The first turn of a pair is accepted on either side and its direction comes back as `sign`;
// the second must be the opposite. So a mirrored or non-mirrored camera cannot flip the check.

export type GuideStep = "straight" | "side1" | "side2" | "vert1" | "vert2";

export const GUIDE = {
  /** Degrees of yaw that count as "turned" / pitch that count as "up or down". */
  side: 15,
  vert: 10,
  /** Straight means within these. */
  straightYaw: 8,
  straightPitch: 10,
  /** Head tilt (roll) allowed. */
  roll: 18,
  /** Face centre must be inside this part of the frame (0..1). */
  centreX: [0.3, 0.7] as const,
  centreY: [0.25, 0.68] as const,
  /** Face width as part of the frame width. */
  minWidth: 0.24,
  maxWidth: 0.78,
  minBrightness: 30,
};

export type FixCode =
  | "no_face"
  | "many_faces"
  | "move_left"
  | "move_right"
  | "move_up"
  | "move_down"
  | "closer"
  | "farther"
  | "level"
  | "light"
  | "straight"
  | "more"
  | "other_way"
  | "ok";

export const FIX_TEXT: Record<FixCode, string> = {
  no_face: "Face not found. Look at the camera in good light.",
  many_faces: "Only one person in the picture, please.",
  move_left: "Move a little to the left",
  move_right: "Move a little to the right",
  move_up: "Raise the phone a little",
  move_down: "Lower the phone a little",
  closer: "Come a little closer",
  farther: "Move the phone a little back",
  level: "Keep your head level",
  light: "Too dark. Face a window or a light.",
  straight: "Look straight at the camera",
  more: "A little more",
  other_way: "Turn the other way",
  ok: "Hold still",
};

export interface FaceReading {
  yaw: number;
  pitch: number;
  roll: number;
  box: FaceBox;
  brightness: number | null;
  faces: number;
}

export interface Judgement {
  accept: boolean;
  fix: FixCode;
  hint: string;
  /** Direction of a turn (+1 / -1), for the first step of a pair. */
  sign?: number;
  /** 0..1, how far the head is turned toward the goal (for the live progress ring). */
  progress: number;
}

/**
 * `mirrored` = the picture is mirrored like the selfie preview, so "face is on the left of the
 * image" means the person should move to their right... which on a mirrored preview also moves
 * the face to the right of the screen. Hints are worded for what the person sees on screen.
 */
export function judge(step: GuideStep, r: FaceReading, ref = 0): Judgement {
  const fail = (fix: FixCode, progress = 0): Judgement => ({ accept: false, fix, hint: FIX_TEXT[fix], progress });
  if (r.faces > 1) return fail("many_faces");
  const cx = r.box.left + r.box.width / 2;
  const cy = r.box.top + r.box.height / 2;
  // Position first: a misaligned face must never be captured.
  if (r.box.width < GUIDE.minWidth) return fail("closer");
  if (r.box.width > GUIDE.maxWidth) return fail("farther");
  if (cx < GUIDE.centreX[0]) return fail("move_right");
  if (cx > GUIDE.centreX[1]) return fail("move_left");
  if (cy < GUIDE.centreY[0]) return fail("move_down");
  if (cy > GUIDE.centreY[1]) return fail("move_up");
  if (r.brightness != null && r.brightness < GUIDE.minBrightness) return fail("light");
  if (Math.abs(r.roll) > GUIDE.roll) return fail("level");

  if (step === "straight") {
    const ok = Math.abs(r.yaw) < GUIDE.straightYaw && Math.abs(r.pitch) < GUIDE.straightPitch;
    const progress = Math.max(0, 1 - Math.max(Math.abs(r.yaw) / 30, Math.abs(r.pitch) / 30));
    return ok ? { accept: true, fix: "ok", hint: FIX_TEXT.ok, progress: 1 } : fail("straight", progress);
  }
  const side = step.startsWith("side");
  const value = side ? r.yaw : r.pitch;
  const need = side ? GUIDE.side : GUIDE.vert;
  const sign = Math.sign(value) || 1;
  const second = step.endsWith("2");
  if (second && ref && sign === ref && Math.abs(value) > 4) return fail("other_way");
  const progress = Math.min(1, Math.abs(value) / need);
  if (Math.abs(value) < need) return fail("more", progress);
  // While turning, the other axis should stay roughly neutral (a diagonal pose is not useful).
  const other = side ? r.pitch : r.yaw;
  if (Math.abs(other) > (side ? 18 : 20)) return fail(side ? "level" : "straight", progress);
  return { accept: true, fix: "ok", hint: FIX_TEXT.ok, sign, progress: 1 };
}

/** Two readings in a row are "stable" when the head and the face box barely moved. */
export function stable(a: FaceReading, b: FaceReading) {
  const ca = [a.box.left + a.box.width / 2, a.box.top + a.box.height / 2];
  const cb = [b.box.left + b.box.width / 2, b.box.top + b.box.height / 2];
  return Math.abs(a.yaw - b.yaw) < 6 && Math.abs(a.pitch - b.pitch) < 6 && Math.hypot(ca[0] - cb[0], ca[1] - cb[1]) < 0.05;
}
