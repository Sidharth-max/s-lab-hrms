"use client";

import { useActionState, useState } from "react";
import { requestLoginOtp, verifyLoginOtp } from "@/app/actions/auth";
import { useT } from "@/components/LangProvider";

export function LoginForm() {
  const t = useT();
  const [sent, sendAction, sending] = useActionState(requestLoginOtp, null);
  const [verified, verifyAction, verifying] = useActionState(verifyLoginOtp, null);
  const [editPhone, setEditPhone] = useState(false);
  const phone = (sent?.data?.phone as string | undefined) ?? "";
  const devCode = sent?.data?.devCode as string | undefined;
  const step = sent?.ok && !editPhone ? "code" : "phone";

  if (step === "phone") {
    return (
      <form action={(f) => { setEditPhone(false); sendAction(f); }} className="flex flex-col gap-3">
        <label className="label" htmlFor="phone">{t("Mobile number", "मोबाइल नंबर")}</label>
        <input id="phone" name="phone" className="input" inputMode="numeric" autoComplete="tel" placeholder={t("10 digit mobile", "10 अंक का मोबाइल")} defaultValue={phone} required autoFocus />
        <button className="btn-primary" disabled={sending}>{sending ? t("Sending…", "भेज रहे हैं…") : t("Get OTP", "OTP भेजें")}</button>
        {sent?.error && <p className="text-sm text-red-600">{sent.error}</p>}
      </form>
    );
  }

  return (
    <form action={verifyAction} className="flex flex-col gap-3">
      <input type="hidden" name="phone" value={phone} />
      <p className="text-sm">{sent?.message} <span className="font-semibold">{phone}</span></p>
      {devCode && (
        <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
          {t("Test mode: your OTP is", "टेस्ट मोड: आपका OTP है")} <b className="tracking-widest">{devCode}</b>
        </p>
      )}
      <label className="label" htmlFor="code">OTP</label>
      <input id="code" name="code" className="input tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus />
      <button className="btn-primary" disabled={verifying}>{verifying ? t("Checking…", "जाँच हो रही है…") : t("Log in", "लॉग इन")}</button>
      {verified?.error && <p className="text-sm text-red-600">{verified.error}</p>}
      <button type="button" className="text-sm text-[var(--brand)] underline" onClick={() => setEditPhone(true)}>
        {t("Change number / resend OTP", "नंबर बदलें / OTP दोबारा भेजें")}
      </button>
    </form>
  );
}
