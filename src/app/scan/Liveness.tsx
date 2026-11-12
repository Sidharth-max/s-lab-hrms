"use client";

import "@aws-amplify/ui-react/styles.css";
import { FaceLivenessDetectorCore } from "@aws-amplify/ui-react-liveness";

// Hindi text for the AWS liveness screen (keys from LivenessDisplayText).
const hindi = {
  hintCenterFaceText: "चेहरा बीच में रखें",
  hintMoveFaceFrontOfCameraText: "कैमरे के सामने आएं",
  hintTooManyFacesText: "एक समय में एक ही व्यक्ति",
  hintFaceDetectedText: "चेहरा मिल गया",
  hintCanNotIdentifyText: "कैमरे की तरफ़ देखें",
  hintTooCloseText: "थोड़ा पीछे हटें",
  hintTooFarText: "थोड़ा पास आएं",
  hintConnectingText: "जुड़ रहा है…",
  hintVerifyingText: "जाँच हो रही है…",
  hintHoldFaceForFreshnessText: "स्थिर रहें",
  hintMatchIndicatorText: "50% पूरा, थोड़ा और पास आएं",
  hintCheckCompleteText: "जाँच पूरी",
  hintIlluminationTooBrightText: "कम रोशनी वाली जगह जाएं",
  hintIlluminationTooDarkText: "ज़्यादा रोशनी वाली जगह जाएं",
  goodFitCaptionText: "ठीक है",
  tooFarCaptionText: "बहुत दूर",
};

export default function Liveness({
  sessionId,
  region,
  lang,
  onDone,
  onError,
}: {
  sessionId: string;
  region: string;
  lang: "hi" | "en";
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  return (
    <FaceLivenessDetectorCore
      sessionId={sessionId}
      region={region}
      disableStartScreen
      displayText={lang === "hi" ? hindi : undefined}
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
