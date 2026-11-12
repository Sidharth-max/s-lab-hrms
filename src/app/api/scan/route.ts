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
    region: env.awsRegion,
    testEmployees,
  });
}

export async function POST(req: Request) {
  const device = await getDevice();
  if (!device) return NextResponse.json({ ok: false, message: "यह डिवाइस रजिस्टर नहीं है" }, { status: 401 });
  if (rateLimited(device.id)) return NextResponse.json({ ok: false, message: "बहुत जल्दी, थोड़ा रुकें" }, { status: 429 });

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
    if (!sid || usedSessions.has(sid)) return NextResponse.json({ ok: false, message: "फिर से कोशिश करें" }, { status: 400 });
    usedSessions.set(sid, Date.now());
    for (const [k, t] of usedSessions) if (Date.now() - t > 10 * 60000) usedSessions.delete(k);
    const r = await livenessResult(sid).catch(() => null);
    if (!r || r.status !== "SUCCEEDED" || r.confidence < env.livenessThreshold || !r.image) {
      return NextResponse.json({ ok: false, message: "चेहरा साफ़ नहीं दिखा, फिर से कोशिश करें" });
    }
    image = r.image;
    liveness = r.confidence;
  } else {
    image = decodeImage(body.image);
    if (!image) return NextResponse.json({ ok: false, message: "फोटो नहीं मिली, फिर से कोशिश करें" }, { status: 400 });
  }

  const mockId = env.faceProvider === "mock" && typeof body.mockEmployeeId === "string" ? body.mockEmployeeId : undefined;
  const match = await faceProvider().search(device.businessId, image, mockId);
  await db.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
  if (!match.ok) {
    const msg =
      match.reason === "no_face"
        ? "चेहरा नहीं दिखा, कैमरे की तरफ़ देखें"
        : match.reason === "ambiguous"
          ? "पहचान पक्की नहीं हुई, मैनेजर से मिलें"
          : match.reason === "error"
            ? "सर्विस में दिक्कत, फिर से कोशिश करें"
            : "पहचान नहीं हुई, मैनेजर से मिलें";
    return NextResponse.json({ ok: false, message: msg });
  }

  const employee = await db.employee.findFirst({ where: { id: match.employeeId, businessId: device.businessId, active: true } });
  if (!employee || !employee.faceId || (env.faceProvider === "aws" && employee.faceId.startsWith("mock-"))) return NextResponse.json({ ok: false, message: "पहचान नहीं हुई, मैनेजर से मिलें" });

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
    ? `${first}, आपकी हाज़िरी पहले ही लग चुकी है`
    : result.type === "IN"
      ? `नमस्ते ${first}, आपकी हाज़िरी लग गई। समय ${time}`
      : `धन्यवाद ${first}, आपकी छुट्टी दर्ज हो गई। समय ${time}`;
  return NextResponse.json({
    ok: true,
    duplicate: result.duplicate,
    type: result.type,
    name: employee.name,
    code: employee.code,
    time,
    speech,
  });
}
