import { json, staff } from "@/lib/api";
import { buildSalaryView } from "@/lib/salary-view";
import { parseShow } from "@/lib/show-filter";

// Everyone's salary balance for the app's Salary screen. Same data model as the website (src/lib/salary-view.ts).
export async function GET(req: Request) {
  return staff(async (actor) => json(await buildSalaryView(actor, parseShow(new URL(req.url).searchParams.get("show")))));
}
