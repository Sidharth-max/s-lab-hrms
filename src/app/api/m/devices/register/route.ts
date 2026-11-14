import { titleCase } from "@/lib/text";
import { randomBytes } from "node:crypto";
import { hashToken } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { apiError, json, readJson, staff } from "@/lib/api";
import { canSeeSite } from "@/lib/permissions";

// Turns the phone/tablet running the app into a face scanner. The app stores the returned token.
// The app sends the phone's Android ID: registering the same phone again (after a reinstall or a
// rename) updates its existing entry and gives it a new token, so no duplicate scanner appears.
export async function POST(req: Request) {
  return staff(async (actor) => {
    const body = await readJson(req);
    const site = await db.site.findFirst({ where: { id: String(body.siteId ?? ""), businessId: actor.businessId, active: true } });
    if (!site || !canSeeSite(actor, site.id)) return apiError("Choose a site");
    const name = titleCase(String(body.name ?? "")).slice(0, 60) || `${site.name} scanner`;
    const hardwareId = String(body.hardwareId ?? "").trim().slice(0, 100) || null;
    const model = String(body.model ?? "").trim().slice(0, 100) || null;
    const token = randomBytes(32).toString("base64url");
    const data = { siteId: site.id, name, model, tokenHash: hashToken(token), registeredBy: actor.id, revokedAt: null };

    const existing = hardwareId
      ? await db.device.findFirst({ where: { businessId: actor.businessId, hardwareId }, orderBy: [{ revokedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }] })
      : null;
    const device = existing
      ? await db.device.update({ where: { id: existing.id }, data })
      : await db.device.create({ data: { ...data, businessId: actor.businessId, hardwareId } });
    if (existing && hardwareId) {
      // Any older entries for the same phone stop working.
      await db.device.updateMany({ where: { businessId: actor.businessId, hardwareId, id: { not: device.id }, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await audit(actor.businessId, actor.id, existing ? "device.reregister" : "device.register", "Device", device.id, { name, siteId: site.id, via: "app" });
    return json({ ok: true, deviceToken: token, device: { id: device.id, name, site: site.name }, reused: !!existing });
  }, "devices.register");
}
