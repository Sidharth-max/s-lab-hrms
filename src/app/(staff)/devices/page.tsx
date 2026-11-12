import Link from "next/link";
import { forgetThisDevice, registerDevice, revokeDevice, setDeviceLanguage } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { getDevice, requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n-server";
import { siteWhere } from "@/lib/scope";

export default async function DevicesPage() {
  const actor = await requireStaff("devices.register");
  const { t, lang } = await getT();
  const [devices, sites, current] = await Promise.all([
    db.device.findMany({ where: { businessId: actor.businessId }, include: { site: true }, orderBy: { createdAt: "desc" } }),
    db.site.findMany({ where: { ...siteWhere(actor), active: true }, orderBy: { name: "asc" } }),
    getDevice(),
  ]);
  const users = new Map((await db.user.findMany({ where: { id: { in: devices.map((d) => d.registeredBy) } } })).map((u) => [u.id, u.name]));
  const langName = (l: string) => (l === "en" ? "English" : "हिंदी");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1">{t("Scanner devices", "स्कैनर डिवाइस")}</h1>
      <section className="card flex flex-col gap-3">
        <h2 className="font-semibold">{t("This device", "यह डिवाइस")}</h2>
        {current ? (
          <div className="flex flex-wrap items-center gap-3">
            <span>{t("Registered as", "रजिस्टर है:")} <b>{current.name}</b> ({current.site.name}, {langName(current.language)}).</span>
            <Link href="/scan" className="btn-primary">{t("Open face scan", "फ़ेस स्कैन खोलें")}</Link>
            <form action={forgetThisDevice}><button className="btn-secondary">{t("Stop using as scanner", "स्कैनर के रूप में बंद करें")}</button></form>
          </div>
        ) : (
          <>
            <p className="muted">
              {t("Make this phone / tablet the attendance scanner for a site. Workers will then only see the face scan screen.", "इस फ़ोन / टैबलेट को साइट का हाज़िरी स्कैनर बनाएं। फिर कर्मचारियों को सिर्फ़ फ़ेस स्कैन स्क्रीन दिखेगी।")}
            </p>
            <ActionForm action={registerDevice} className="grid gap-3 @2xl:grid-cols-2" submitLabel={t("Make this device a scanner", "इस डिवाइस को स्कैनर बनाएं")}>
              <div>
                <label className="label">{t("Site", "साइट")}</label>
                <select name="siteId" className="input" required>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">{t("Name", "नाम")}</label>
                <input name="name" className="input" placeholder={t("e.g. Gate tablet", "जैसे गेट टैबलेट")} />
              </div>
              <div>
                <label className="label">{t("Scanner language (screen and voice)", "स्कैनर की भाषा (स्क्रीन और आवाज़)")}</label>
                <select name="language" className="input" defaultValue="hi">
                  <option value="hi">हिंदी</option>
                  <option value="en">English</option>
                </select>
              </div>
              <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" name="logout" defaultChecked /> {t("Log me out and open scanner", "मुझे लॉग आउट करके स्कैनर खोलें")}</label>
            </ActionForm>
          </>
        )}
      </section>
      <div className="card overflow-x-auto !p-0">
        <table className="table table-cards">
          <thead>
            <tr><th>{t("Name", "नाम")}</th><th>{t("Site", "साइट")}</th><th>{t("Language", "भाषा")}</th><th>{t("Registered by", "किसने जोड़ा")}</th><th>{t("Last scan", "आख़िरी स्कैन")}</th><th /></tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id} className={d.revokedAt ? "text-[var(--muted)]" : ""}>
                <td className="card-title">{d.name}{current?.id === d.id && <span className="badge ml-1 bg-blue-50 text-[var(--brand)]">{t("this device", "यह डिवाइस")}</span>}</td>
                <td data-label={t("Site", "साइट")}>{d.site.name}</td>
                <td data-label={t("Language", "भाषा")}>
                  {d.revokedAt ? langName(d.language) : (
                    <ActionForm action={setDeviceLanguage} className="flex items-center gap-1" submitLabel={t("Set", "बदलें")} submitClass="btn-secondary !px-2 !py-1">
                      <input type="hidden" name="deviceId" value={d.id} />
                      <select name="language" className="input !w-auto !py-1" defaultValue={d.language}>
                        <option value="hi">हिंदी</option>
                        <option value="en">English</option>
                      </select>
                    </ActionForm>
                  )}
                </td>
                <td data-label={t("Registered by", "किसने जोड़ा")}>{users.get(d.registeredBy) ?? "?"} · {d.createdAt.toLocaleDateString("en-IN")}</td>
                <td data-label={t("Last scan", "आख़िरी स्कैन")}>{d.lastSeenAt?.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) ?? "—"}</td>
                <td>
                  {d.revokedAt ? t("Removed", "हटाया गया") : (
                    <ActionForm action={revokeDevice} submitLabel={t("Remove", "हटाएं")} submitClass="btn-danger !py-1" confirm={t("Remove this scanner? It will stop working immediately.", "यह स्कैनर हटाएं? यह तुरंत काम करना बंद कर देगा।")}>
                      <input type="hidden" name="deviceId" value={d.id} />
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
            {devices.length === 0 && <tr><td colSpan={6} className="muted">{t("No scanners yet.", "अभी कोई स्कैनर नहीं।")}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted">{lang === "hi" ? "स्कैनर की भाषा इस स्क्रीन की भाषा से अलग हो सकती है।" : "The scanner language can differ from the language of this screen."}</p>
    </div>
  );
}
