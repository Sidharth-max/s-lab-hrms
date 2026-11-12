import { redirect } from "next/navigation";
import { getActor, getDevice } from "@/lib/auth";

// Logged in -> dashboard / employee portal. Registered scanner -> scan screen. Otherwise -> login.
export default async function Home() {
  const actor = await getActor();
  if (actor) redirect(actor.role === "EMPLOYEE" ? "/me" : "/dashboard");
  if (await getDevice()) redirect("/scan");
  redirect("/login");
}
