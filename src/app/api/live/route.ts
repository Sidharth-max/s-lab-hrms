import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { eventStream } from "@/lib/events";

// Live updates for website pages (login cookie).
export async function GET(req: Request) {
  const actor = await getActor();
  if (!actor || actor.role === "EMPLOYEE") return new NextResponse("Not signed in", { status: 401 });
  return eventStream(actor.businessId, req.signal);
}
