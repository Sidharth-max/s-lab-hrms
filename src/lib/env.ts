// Server configuration read from environment variables. See .env.example for descriptions.

function bool(v: string | undefined, d = false) {
  if (v == null || v === "") return d;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

export const env = {
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  authSecret: process.env.AUTH_SECRET ?? "",
  smsProvider: (process.env.SMS_PROVIDER ?? "console") as "console" | "msg91",
  // TESTING ONLY: shows the OTP on screen so you can log in without an SMS provider.
  otpShowInUi: bool(process.env.OTP_SHOW_IN_UI),
  msg91AuthKey: process.env.MSG91_AUTH_KEY ?? "",
  msg91TemplateId: process.env.MSG91_TEMPLATE_ID ?? "",
  faceProvider: (process.env.FACE_PROVIDER ?? "mock") as "mock" | "aws",
  faceMatchThreshold: Number(process.env.FACE_MATCH_THRESHOLD ?? 95),
  faceLiveness: bool(process.env.FACE_LIVENESS),
  livenessThreshold: Number(process.env.FACE_LIVENESS_THRESHOLD ?? 80),
  awsRegion: process.env.AWS_REGION ?? "ap-south-1",
  awsLivenessRoleArn: process.env.AWS_LIVENESS_ROLE_ARN ?? "",
  githubRepo: process.env.GITHUB_REPO ?? "Sidharth-max/s-lab-hrms",
  secureCookies: bool(process.env.SECURE_COOKIES, process.env.NODE_ENV === "production"),
};

export function requireAuthSecret(): string {
  if (env.authSecret.length < 32) {
    throw new Error("AUTH_SECRET must be set to a random string of at least 32 characters");
  }
  return env.authSecret;
}
