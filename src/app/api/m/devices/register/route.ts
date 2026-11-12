import { randomBytes } from "node:crypto";
import { hashToken } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { apiError, json, readJson, staff } from "@/lib/api";
import { canSeeSite } from "@/lib/permissions";

// Turns the phone/tablet running the app into a face scanner. The app stores the returned token.
export async function POST(req: Request) {
  return staff(async (actor) => {
    const body = await readJson(req);
    const site = await db.site.findFirst({ where: { id: String(body.siteId ?? ""), businessId: actor.businessId, active: true } });
    if (!site || !canSeeSite(actor, site.id)) return apiError("Choose a site");
    const name = String(body.name ?? "").trim() || `${site.name} scanner`;
    const token = randomBytes(32).toString("base64url");
    const device = await db.device.create({
      data: { businessId: actor.businessId, siteId: site.id, name, tokenHash: hashToken(token), registeredBy: actor.id },
    });
    await audit(actor.businessId, actor.id, "device.register", "Device", device.id, { name, siteId: site.id, via: "app" });
    return json({ ok: true, deviceToken: token, device: { id: device.id, name, site: site.name } });
  }, "devices.register");
}
