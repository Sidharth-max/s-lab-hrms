import Link from "next/link";
import { getDevice } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { Scanner } from "./Scanner";

export default async function ScanPage() {
  const device = await getDevice();
  if (!device) {
    const { t } = await getT();
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-4 text-center">
        <h1 className="h1">{t("Scanner not set up", "स्कैनर सेट नहीं है")}</h1>
        <p className="muted">
          {t(
            "This device is not registered for attendance. The owner or a manager must log in once on this device and choose “Make this device a scanner” under Devices.",
            "यह डिवाइस हाज़िरी के लिए रजिस्टर नहीं है। मालिक या मैनेजर एक बार इस डिवाइस पर लॉग इन करके डिवाइस में “इस डिवाइस को स्कैनर बनाएं” चुनें।",
          )}
        </p>
        <Link href="/login" className="btn-primary">{t("Manager / owner login", "मैनेजर / मालिक लॉग इन")}</Link>
      </main>
    );
  }
  return <Scanner />;
}
