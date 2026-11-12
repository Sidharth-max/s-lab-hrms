import "server-only";
import { CreateFaceLivenessSessionCommand, GetFaceLivenessSessionResultsCommand } from "@aws-sdk/client-rekognition";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { env } from "../env";
import { rekognition } from "./aws";

// AWS Face Liveness (optional, FACE_LIVENESS=true). The tablet streams a short selfie video
// straight to AWS using short-lived credentials that can ONLY start a liveness session.

export async function createLivenessSession(): Promise<string> {
  const res = await rekognition().send(new CreateFaceLivenessSessionCommand({}));
  if (!res.SessionId) throw new Error("No liveness session");
  return res.SessionId;
}

export async function livenessResult(sessionId: string): Promise<{ confidence: number; image: Buffer | null; status: string }> {
  const res = await rekognition().send(new GetFaceLivenessSessionResultsCommand({ SessionId: sessionId }));
  const bytes = res.ReferenceImage?.Bytes;
  return { confidence: res.Confidence ?? 0, image: bytes ? Buffer.from(bytes) : null, status: res.Status ?? "UNKNOWN" };
}

/** 15-minute credentials limited to rekognition:StartFaceLivenessSession. */
export async function livenessCredentials() {
  if (!env.awsLivenessRoleArn) throw new Error("AWS_LIVENESS_ROLE_ARN is not set");
  const sts = new STSClient({ region: env.awsRegion });
  const res = await sts.send(
    new AssumeRoleCommand({
      RoleArn: env.awsLivenessRoleArn,
      RoleSessionName: `hrms-liveness-${Date.now()}`,
      DurationSeconds: 900,
      Policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{ Effect: "Allow", Action: "rekognition:StartFaceLivenessSession", Resource: "*" }],
      }),
    }),
  );
  const c = res.Credentials;
  if (!c?.AccessKeyId || !c.SecretAccessKey || !c.SessionToken) throw new Error("No credentials");
  return {
    accessKeyId: c.AccessKeyId,
    secretAccessKey: c.SecretAccessKey,
    sessionToken: c.SessionToken,
    expiration: c.Expiration?.toISOString(),
  };
}
