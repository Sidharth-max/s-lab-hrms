import { env } from "./env";

/** How long an OTP is valid. Also shown in the SMS text. */
export const OTP_MINUTES = 5;

/**
 * Sends an OTP by SMS.
 * - "console": prints to the server log only (testing; no SMS is sent).
 * - "fast2sms": Fast2SMS. Needs FAST2SMS_API_KEY and one of:
 *     FAST2SMS_MODE=otp  + FAST2SMS_OTP_ID (OTP template ID from the Fast2SMS OTP section), or
 *     FAST2SMS_MODE=dlt  + FAST2SMS_SENDER_ID + FAST2SMS_DLT_MESSAGE_ID (DLT template with two
 *                          variables: the OTP, then the minutes it is valid for).
 * The app always creates and checks the OTP itself; Fast2SMS only delivers it.
 */
export async function sendOtpSms(phone: string, code: string, purpose: string): Promise<void> {
  if (env.smsProvider === "fast2sms") {
    await sendFast2Sms(phone, code);
    return;
  }
  console.log(`[sms:console] OTP for ${phone} (${purpose}): ${code}`);
}

export function fast2SmsRequest(phone: string, code: string): { url: string; body: Record<string, unknown> } {
  if (env.fast2sms.mode === "dlt") {
    if (!env.fast2sms.senderId || !env.fast2sms.dltMessageId) throw new Error("Fast2SMS DLT is not configured");
    return {
      url: "https://www.fast2sms.com/dev/bulkV2",
      body: {
        route: "dlt",
        sender_id: env.fast2sms.senderId,
        message: Number(env.fast2sms.dltMessageId),
        // DLT template has two variables: the OTP, then the minutes it is valid for.
        variables_values: `${code}|${OTP_MINUTES}`,
        numbers: phone,
      },
    };
  }
  if (!env.fast2sms.otpId) throw new Error("Fast2SMS OTP template is not configured");
  return {
    url: "https://www.fast2sms.com/dev/otp/send",
    body: { mobile: phone, otp_id: env.fast2sms.otpId, otp: code, otp_length: code.length, otp_expiry: OTP_MINUTES },
  };
}

async function sendFast2Sms(phone: string, code: string) {
  if (!env.fast2sms.apiKey) throw new Error("FAST2SMS_API_KEY is not set");
  const { url, body } = fast2SmsRequest(phone, code);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: env.fast2sms.apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = (await res.json().catch(() => null)) as { return?: boolean; message?: unknown; status_code?: number } | null;
  if (!res.ok || !data?.return) {
    // Never log the key; the message from Fast2SMS explains what is wrong (balance, template, number).
    throw new Error(`Fast2SMS failed (${res.status}): ${JSON.stringify(data?.message ?? data)}`);
  }
}
