import { NextResponse } from "next/server";
import { getDevice } from "@/lib/auth";
import { nextPunch } from "@/lib/attendance";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { decodeImage, faceProvider } from "@/lib/face";
import { livenessResult } from "@/lib/face/liveness";
import { dateKeyToDb, dbToDateKey, formatIstTime, istDateKey } from "@/lib/time";

// Liveness session ids may only be used once.
const usedSessions = new Map<string, number>();
// Very small per-device rate limit (scans per minute).
const recentScans = new Map<string, number[]>();

function rateLimited(deviceId: string) {
  const now = Date.now();
  const list = (recentScans.get(deviceId) ?? []).filter((t) => now - t < 60000);
  list.push(now);
  recentScans.set(deviceId, list);
  return list.length > 30;
}

/** Scanner screen setup: who is this device, which mode. */
export async function GET() {
  const device = await getDevice();
  if (!device) return NextResponse.json({ registered: false }, { status: 401 });
  const testEmployees =
    env.faceProvider === "mock"
      ? await db.employee.findMany({
          where: { businessId: device.businessId, active: true, faceId: { not: null } },
          select: { id: true, name: true, code: true },
          orderBy: { name: "asc" },
        })
      : [];
  return NextResponse.json({
    registered: true,
    device: { name: device.name, site: device.site.name, business: device.business.name },
    mode: env.faceProvider,
    liveness: env.faceProvider === "aws" && env.faceLiveness,
    language: device.language === "en" ? "en" : "hi",
    region: env.awsRegion,
    testEmployees,
  });
}

export async function POST(req: Request) {
  const device = await getDevice();
  if (!device) return NextResponse.json({ ok: false, message: "यह डिवाइस रजिस्टर नहीं है / Device not registered" }, { status: 401 });
  // Messages in the scanner's language (set when the device was registered).
  const m = (hi: string, en: string) => (device.language === "en" ? en : hi);
  if (rateLimited(device.id)) return NextResponse.json({ ok: false, message: m("बहुत जल्दी, थोड़ा रुकें", "Too fast, please wait") }, { status: 429 });

  let body: { image?: unknown; mockEmployeeId?: unknown; livenessSessionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request" }, { status: 400 });
  }

  let image: Buffer | null = null;
  let liveness: number | null = null;
  if (env.faceProvider === "aws" && env.faceLiveness) {
    const sid = typeof body.livenessSessionId === "string" ? body.livenessSessionId : "";
    if (!sid || usedSessions.has(sid)) return NextResponse.json({ ok: false, message: m("फिर से कोशिश करें", "Please try again") }, { status: 400 });
    usedSessions.set(sid, Date.now());
    for (const [k, t] of usedSessions) if (Date.now() - t > 10 * 60000) usedSessions.delete(k);
    const r = await livenessResult(sid).catch(() => null);
    if (!r || r.status !== "SUCCEEDED" || r.confidence < env.livenessThreshold || !r.image) {
      return NextResponse.json({ ok: false, message: m("चेहरा साफ़ नहीं दिखा, फिर से कोशिश करें", "Face not clear, please try again") });
    }
    image = r.image;
    liveness = r.confidence;
  } else {
    image = decodeImage(body.image);
    if (!image) return NextResponse.json({ ok: false, message: m("फोटो नहीं मिली, फिर से कोशिश करें", "No photo received, please try again") }, { status: 400 });
  }

  const mockId = env.faceProvider === "mock" && typeof body.mockEmployeeId === "string" ? body.mockEmployeeId : undefined;
  const match = await faceProvider().search(device.businessId, image, mockId);
  await db.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
  if (!match.ok) {
    const msg =
      match.reason === "no_face"
        ? m("चेहरा नहीं दिखा, कैमरे की तरफ़ देखें", "No face seen, look at the camera")
        : match.reason === "ambiguous"
          ? m("पहचान पक्की नहीं हुई, मैनेजर से मिलें", "Not sure who you are, please see the manager")
          : match.reason === "error"
            ? m("सर्विस में दिक्कत, फिर से कोशिश करें", "Service problem, please try again")
            : m("पहचान नहीं हुई, मैनेजर से मिलें", "Not recognised, please see the manager");
    return NextResponse.json({ ok: false, message: msg });
  }

  const employee = await db.employee.findFirst({ where: { id: match.employeeId, businessId: device.businessId, active: true } });
  if (!employee || !employee.faceId || (env.faceProvider === "aws" && employee.faceId.startsWith("mock-"))) return NextResponse.json({ ok: false, message: m("पहचान नहीं हुई, मैनेजर से मिलें", "Not recognised, please see the manager") });

  const now = new Date();
  const result = await db.$transaction(async (tx) => {
    // One scan at a time per employee, so two quick scans cannot both create an IN.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${employee.id}))`;
    const last = await tx.attendancePunch.findFirst({
      where: { employeeId: employee.id, voidedAt: null },
      orderBy: { at: "desc" },
    });
    const business = await tx.business.findUniqueOrThrow({ where: { id: device.businessId } });
    const decision = nextPunch(
      last ? { type: last.type, at: last.at, workDate: dbToDateKey(last.workDate) } : null,
      now,
      istDateKey(now),
      business,
    );
    if (decision.action === "duplicate") return { duplicate: true as const, type: last!.type, at: last!.at };
    const p = await tx.attendancePunch.create({
      data: {
        businessId: device.businessId,
        employeeId: employee.id,
        type: decision.type,
        at: now,
        workDate: dateKeyToDb(decision.workDate),
        source: "FACE",
        deviceId: device.id,
        score: match.similarity,
        liveness,
      },
    });
    return { duplicate: false as const, type: p.type, at: p.at };
  });

  const time = formatIstTime(result.at);
  const first = employee.name.split(" ")[0];
  const speech = result.duplicate
    ? m(`${first}, आपकी हाज़िरी पहले ही लग चुकी है`, `${first}, your attendance is already marked`)
    : result.type === "IN"
      ? m(`नमस्ते ${first}, आपकी हाज़िरी लग गई। समय ${time}`, `Hello ${first}, you are checked in at ${time}`)
      : m(`धन्यवाद ${first}, आपकी छुट्टी दर्ज हो गई। समय ${time}`, `Thank you ${first}, you are checked out at ${time}`);
  const title = result.duplicate
    ? m("पहले ही दर्ज है", "Already marked")
    : result.type === "IN"
      ? m("हाज़िरी लग गई ✓", "Checked in ✓")
      : m("छुट्टी दर्ज ✓", "Checked out ✓");
  return NextResponse.json({
    ok: true,
    duplicate: result.duplicate,
    type: result.type,
    name: employee.name,
    code: employee.code,
    time,
    speech,
    title,
  });
}
