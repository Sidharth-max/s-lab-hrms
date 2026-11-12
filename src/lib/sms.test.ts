import { afterEach, describe, expect, it, vi } from "vitest";

async function load(vars: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
  return import("./sms");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Fast2SMS", () => {
  it("builds the OTP template request", async () => {
    const { fast2SmsRequest } = await load({ FAST2SMS_MODE: "otp", FAST2SMS_OTP_ID: "123" });
    expect(fast2SmsRequest("9876543210", "482913")).toEqual({
      url: "https://www.fast2sms.com/dev/otp/send",
      body: { mobile: "9876543210", otp_id: "123", otp: "482913", otp_length: 6, otp_expiry: 5 },
    });
  });

  it("builds the DLT request", async () => {
    const { fast2SmsRequest } = await load({ FAST2SMS_MODE: "dlt", FAST2SMS_SENDER_ID: "SLABHR", FAST2SMS_DLT_MESSAGE_ID: "171234" });
    expect(fast2SmsRequest("9876543210", "482913")).toEqual({
      url: "https://www.fast2sms.com/dev/bulkV2",
      body: { route: "dlt", sender_id: "SLABHR", message: 171234, variables_values: "482913", numbers: "9876543210" },
    });
  });

  it("refuses to send without configuration", async () => {
    const { fast2SmsRequest } = await load({ FAST2SMS_MODE: "otp", FAST2SMS_OTP_ID: "" });
    expect(() => fast2SmsRequest("9876543210", "482913")).toThrow(/not configured/);
  });

  it("sends with the key and reports Fast2SMS errors", async () => {
    const { sendOtpSms } = await load({ SMS_PROVIDER: "fast2sms", FAST2SMS_API_KEY: "test-key", FAST2SMS_OTP_ID: "123" });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ return: false, message: "Invalid OTP ID" }), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendOtpSms("9876543210", "482913", "login")).rejects.toThrow(/Invalid OTP ID/);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("test-key");

    fetchMock.mockResolvedValue(new Response(JSON.stringify({ return: true, message: "OTP sent successfully" })));
    await expect(sendOtpSms("9876543210", "482913", "login")).resolves.toBeUndefined();
  });
});
