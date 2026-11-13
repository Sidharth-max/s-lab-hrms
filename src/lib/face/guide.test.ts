import { describe, expect, it } from "vitest";
import { judge, stable, type FaceReading } from "./guide";

const centred = { left: 0.3, top: 0.25, width: 0.4, height: 0.45 };
const r = (o: Partial<FaceReading> = {}): FaceReading => ({ yaw: 0, pitch: 0, roll: 0, box: centred, brightness: 80, faces: 1, ...o });

describe("face guide", () => {
  it("accepts a centred straight face", () => {
    expect(judge("straight", r()).accept).toBe(true);
  });
  it("refuses a face that drifted to the side even if the pose is right", () => {
    const j = judge("straight", r({ box: { ...centred, left: 0.02 } }));
    expect(j.accept).toBe(false);
    expect(j.fix).toBe("move_right");
    expect(judge("side1", r({ yaw: 25, box: { ...centred, left: 0.55 } })).fix).toBe("move_left");
  });
  it("asks to come closer or move back", () => {
    expect(judge("straight", r({ box: { left: 0.42, top: 0.4, width: 0.12, height: 0.15 } })).fix).toBe("closer");
    expect(judge("straight", r({ box: { left: 0.05, top: 0.05, width: 0.9, height: 0.9 } })).fix).toBe("farther");
  });
  it("needs a real turn, then the opposite turn", () => {
    expect(judge("side1", r({ yaw: 6 })).fix).toBe("more");
    const first = judge("side1", r({ yaw: 22 }));
    expect(first.accept).toBe(true);
    expect(first.sign).toBe(1);
    expect(judge("side2", r({ yaw: 22 }), 1).fix).toBe("other_way");
    expect(judge("side2", r({ yaw: -22 }), 1).accept).toBe(true);
  });
  it("checks looking up and down by pitch", () => {
    const up = judge("vert1", r({ pitch: 14 }));
    expect(up.accept).toBe(true);
    expect(judge("vert2", r({ pitch: -14 }), up.sign).accept).toBe(true);
  });
  it("rejects tilted heads, dark pictures and two people", () => {
    expect(judge("straight", r({ roll: 30 })).fix).toBe("level");
    expect(judge("straight", r({ brightness: 10 })).fix).toBe("light");
    expect(judge("straight", r({ faces: 2 })).fix).toBe("many_faces");
  });
  it("stability needs a still head", () => {
    expect(stable(r({ yaw: 20 }), r({ yaw: 22 }))).toBe(true);
    expect(stable(r({ yaw: 20 }), r({ yaw: 35 }))).toBe(false);
    expect(stable(r(), r({ box: { ...centred, left: 0.4 } }))).toBe(false);
  });
});
