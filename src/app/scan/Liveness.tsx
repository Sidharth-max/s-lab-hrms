"use client";

import "@aws-amplify/ui-react/styles.css";
import { FaceLivenessDetectorCore } from "@aws-amplify/ui-react-liveness";

export default function Liveness({
  sessionId,
  region,
  onDone,
  onError,
}: {
  sessionId: string;
  region: string;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  return (
    <FaceLivenessDetectorCore
      sessionId={sessionId}
      region={region}
      disableStartScreen
      onAnalysisComplete={async () => onDone()}
      onError={(e) => onError(e.state ?? "error")}
      config={{
        credentialProvider: async () => {
          const res = await fetch("/api/liveness/credentials", { cache: "no-store" });
          if (!res.ok) throw new Error("No credentials");
          const c = await res.json();
          return {
            accessKeyId: c.accessKeyId,
            secretAccessKey: c.secretAccessKey,
            sessionToken: c.sessionToken,
            expiration: c.expiration ? new Date(c.expiration) : undefined,
          };
        },
      }}
    />
  );
}
