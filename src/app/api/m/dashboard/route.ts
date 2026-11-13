import { json, staff } from "@/lib/api";
import { buildDashboard } from "@/lib/dashboard";

// Today screen for the app. Same data model as the website's dashboard (src/lib/dashboard.ts).
export async function GET() {
  return staff(async (actor) => json(await buildDashboard(actor)));
}
