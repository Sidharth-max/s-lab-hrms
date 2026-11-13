import { getActor } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { eventStream } from "@/lib/events";

// Live updates for the Android app (Bearer token).
export async function GET(req: Request) {
  const actor = await getActor();
  if (!actor || actor.role === "EMPLOYEE") return apiError("Not signed in", 401);
  return eventStream(actor.businessId, req.signal);
}
