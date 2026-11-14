"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { requestLoginOtp, verifyLoginOtp } from "@/app/actions/auth";

export function LoginForm() {
  const [sent, sendAction, sending] = useActionState(requestLoginOtp, null);
  const [verified, verifyAction, verifying] = useActionState(verifyLoginOtp, null);
  // "Change number" goes back to the phone step for the OTP that was sent; a new send shows the code step again.
  const [editedFor, setEditedFor] = useState<typeof sent>(null);
  const phone = (sent?.data?.phone as string | undefined) ?? "";
  const devCode = sent?.data?.devCode as string | undefined;
  const step = sent?.ok && editedFor !== sent ? "code" : "phone";
  const form = useRef<HTMLFormElement>(null);
  const codeBox = useRef<HTMLInputElement>(null);

  // OTP from SMS on the website:
  //  - autocomplete="one-time-code" lets Android Chrome / iOS Safari offer the code from the SMS.
  //  - WebOTP (Chrome on Android) reads it automatically when the SMS's last line is
  //    "@hrms.s-lab.dev #123456" (needs that line in the Fast2SMS / DLT template).
  // Either way, 6 digits submit the form by themselves.
  useEffect(() => {
    if (step !== "code" || !("OTPCredential" in window)) return;
    const ac = new AbortController();
    navigator.credentials
      .get({ otp: { transport: ["sms"] }, signal: ac.signal } as CredentialRequestOptions)
      .then((c) => {
        const otp = (c as unknown as { code?: string } | null)?.code;
        if (otp && codeBox.current) {
          codeBox.current.value = otp;
          form.current?.requestSubmit();
        }
      })
      .catch(() => {});
    return () => ac.abort();
  }, [step]);

  if (step === "phone") {
    return (
      // The server action is the form's own action, so Get OTP also works before (or without) the page
      // script, e.g. on older iPhones where the script loads late.
      <form action={sendAction} className="flex flex-col gap-3">
        <label className="label" htmlFor="phone">Mobile number</label>
        <input id="phone" name="phone" className="input" inputMode="numeric" autoComplete="tel" placeholder={"10 digit mobile"} defaultValue={phone} required autoFocus />
        <button className="btn-primary" disabled={sending}>{sending ? "Sending…" : "Get OTP"}</button>
        {sent?.error && <p className="text-sm text-[var(--red)]">{sent.error}</p>}
      </form>
    );
  }

  return (
    <form ref={form} action={verifyAction} className="flex flex-col gap-3">
      <input type="hidden" name="phone" value={phone} />
      <p className="text-sm">{sent?.message} <span className="font-semibold">{phone}</span></p>
      {devCode && (
        <p className="notice">
          {"Test mode: your OTP is"} <b className="tracking-widest">{devCode}</b>
        </p>
      )}
      <label className="label" htmlFor="code">OTP</label>
      <input
        ref={codeBox}
        id="code"
        name="code"
        className="input !h-14 text-center !text-2xl font-bold tracking-[0.5em] tabular-nums"
        placeholder="••••••"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        required
        autoFocus
        onChange={(e) => {
          if (e.target.value.replace(/\D/g, "").length === 6 && !verifying) form.current?.requestSubmit();
        }}
      />
      <button className="btn-primary" disabled={verifying}>{verifying ? "Checking…" : "Log in"}</button>
      {verified?.error && <p className="text-sm text-[var(--red)]">{verified.error}</p>}
      <button type="button" className="text-sm font-semibold text-[var(--accent-ink)] hover:underline" onClick={() => setEditedFor(sent)}>
        {"Change number / resend OTP"}
      </button>
    </form>
  );
}
