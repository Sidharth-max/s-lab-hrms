// Creates the first business, a site and the owner (OP) account.
// Safe to run again: does nothing if the owner's mobile already exists.
//   OWNER_PHONE=9876543210 OWNER_NAME="Sid" BUSINESS_NAME="GGU" SITE_NAME="Main" npx tsx prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const phone = (process.env.OWNER_PHONE ?? "").replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(phone)) throw new Error("Set OWNER_PHONE to the owner's 10 digit mobile number");
  const existing = await db.user.findUnique({ where: { phone } });
  if (existing) {
    console.log(`Owner ${phone} already exists, nothing to do.`);
    return;
  }
  const business = await db.business.create({ data: { name: process.env.BUSINESS_NAME || "My Business" } });
  await db.site.create({ data: { businessId: business.id, name: process.env.SITE_NAME || "Main site" } });
  await db.user.create({ data: { businessId: business.id, phone, name: process.env.OWNER_NAME || "Owner", role: "OWNER" } });
  console.log(`Created business "${business.name}" with owner ${phone}. Log in with this mobile number.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
