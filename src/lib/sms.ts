import { env } from "./env";

/**
 * Sends an OTP by SMS.
 * - "console": prints to the server log (testing; no SMS is sent).
 * - "msg91": MSG91 OTP template. Needs MSG91_AUTH_KEY and MSG91_TEMPLATE_ID
 *   (a DLT-approved template with an ##OTP## variable).
 */
export async function sendOtpSms(phone: string, code: string, purpose: string): Promise<void> {
  if (env.smsProvider === "msg91") {
    if (!env.msg91AuthKey || !env.msg91TemplateId) throw new Error("MSG91 is not configured");
    const url = new URL("https://control.msg91.com/api/v5/otp");
    url.searchParams.set("template_id", env.msg91TemplateId);
    url.searchParams.set("mobile", `91${phone}`);
    url.searchParams.set("otp", code);
    const res = await fetch(url, { method: "POST", headers: { authkey: env.msg91AuthKey } });
    if (!res.ok) throw new Error(`SMS failed (${res.status})`);
    return;
  }
  console.log(`[sms:console] OTP for ${phone} (${purpose}): ${code}`);
}
