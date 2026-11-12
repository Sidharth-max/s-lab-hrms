import { NextResponse } from "next/server";
import { getDevice } from "@/lib/auth";
import { env } from "@/lib/env";
import { createLivenessSession } from "@/lib/face/liveness";

export async function POST() {
  const device = await getDevice();
  if (!device) return NextResponse.json({ error: "Device not registered" }, { status: 401 });
  if (env.faceProvider !== "aws" || !env.faceLiveness) return NextResponse.json({ error: "Liveness is off" }, { status: 400 });
  try {
    return NextResponse.json({ sessionId: await createLivenessSession() });
  } catch (e) {
    console.error("Liveness session failed", e);
    return NextResponse.json({ error: "Face service error" }, { status: 502 });
  }
}
