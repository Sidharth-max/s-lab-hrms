import { json, staff } from "@/lib/api";
import { listLeaves } from "@/lib/leaves";

// Scheduled leaves (?employeeId= for one person).
export async function GET(req: Request) {
  return staff(async (actor) => {
    const employeeId = new URL(req.url).searchParams.get("employeeId") ?? undefined;
    return json({ leaves: await listLeaves(actor, { employeeId }) });
  });
}
