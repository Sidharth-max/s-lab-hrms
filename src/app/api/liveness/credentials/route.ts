import { NextResponse } from "next/server";
import { getDevice } from "@/lib/auth";
import { env } from "@/lib/env";
import { livenessCredentials } from "@/lib/face/liveness";

// Short-lived credentials that can only start a liveness video stream.
export async function GET() {
  const device = await getDevice();
  if (!device) return NextResponse.json({ error: "Device not registered" }, { status: 401 });
  if (env.faceProvider !== "aws" || !env.faceLiveness) return NextResponse.json({ error: "Liveness is off" }, { status: 400 });
  try {
    return NextResponse.json(await livenessCredentials(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("Liveness credentials failed", e);
    return NextResponse.json({ error: "Face service error" }, { status: 502 });
  }
}
