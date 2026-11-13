# AWS Rekognition setup (face recognition)

Until this is done the app runs in **TEST MODE** (`FACE_PROVIDER=mock`): the scanner asks the tester
to pick who is in front of the camera. Follow these steps to switch on real face recognition.

Region for everything: **Asia Pacific (Mumbai) `ap-south-1`**.

## 1. AWS account

1. Create an AWS account at https://aws.amazon.com (or use the existing company account).
2. Turn on MFA for the root user. Do not use the root user for anything below.
3. In the top right region menu choose **Asia Pacific (Mumbai)**.

## 2. Policy for the server

IAM > Policies > Create policy > JSON. Replace `ACCOUNT_ID` with your 12 digit AWS account id.
Name it `s-lab-hrms-rekognition`.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CreateCollection",
      "Effect": "Allow",
      "Action": "rekognition:CreateCollection",
      "Resource": "*"
    },
    {
      "Sid": "FaceCollections",
      "Effect": "Allow",
      "Action": [
        "rekognition:IndexFaces",
        "rekognition:SearchFacesByImage",
        "rekognition:DeleteFaces",
        "rekognition:ListFaces"
      ],
      "Resource": "arn:aws:rekognition:ap-south-1:ACCOUNT_ID:collection/hrms-*"
    },
    {
      "Sid": "GuidedFaceScan",
      "Effect": "Allow",
      "Action": "rekognition:DetectFaces",
      "Resource": "*"
    },
    {
      "Sid": "Liveness",
      "Effect": "Allow",
      "Action": [
        "rekognition:CreateFaceLivenessSession",
        "rekognition:GetFaceLivenessSessionResults"
      ],
      "Resource": "*"
    },
    {
      "Sid": "LivenessRole",
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::ACCOUNT_ID:role/s-lab-hrms-liveness"
    }
  ]
}
```

## 3. User for the server

1. IAM > Users > Create user, name `s-lab-hrms-server`. No console access.
2. Attach the policy `s-lab-hrms-rekognition`.
3. Open the user > Security credentials > Create access key > "Application running outside AWS".
4. Copy the **Access key ID** and **Secret access key** (shown only once).

## 4. Liveness role (blocks photos / videos held up to the camera)

Liveness makes every scan take about 5 to 10 seconds longer and costs extra per scan. You can start without
it (steps 1 to 3 and 5) and add it later.

1. IAM > Roles > Create role > Custom trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::ACCOUNT_ID:user/s-lab-hrms-server" },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

2. Add an inline permission policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": "rekognition:StartFaceLivenessSession", "Resource": "*" }
  ]
}
```

3. Name the role `s-lab-hrms-liveness` and copy its ARN (`arn:aws:iam::ACCOUNT_ID:role/s-lab-hrms-liveness`).

The tablet never gets the server's keys. For each scan the server hands it 15 minute credentials that
can only start a liveness video stream.

## 5. Put the keys on the server

Edit `.env.production` on the server:

```
FACE_PROVIDER=aws
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
FACE_MATCH_THRESHOLD=95

# Only if you did step 4:
FACE_LIVENESS=true
AWS_LIVENESS_ROLE_ARN=arn:aws:iam::ACCOUNT_ID:role/s-lab-hrms-liveness
```

Then run `./deploy.sh --no-pull` (or `docker compose --env-file .env.production -p s-lab-hrms up -d app`).

## 6. Enroll faces again

Faces saved in test mode are not real face data. After switching to AWS, the Today page lists everyone
who needs enrolling. Open each employee > **Re-take face photo**. Use good light, face straight, no cap or mask.

## 7. Test before real use

1. Scan each enrolled person a few times in the real gate lighting, morning and evening.
2. Try a person who is NOT enrolled: they must get "पहचान नहीं हुई".
3. If genuine workers are often rejected, improve the light first; only then lower `FACE_MATCH_THRESHOLD`
   (for example 90). Do not go below 85.

## 8. Privacy settings (recommended)

- Opt out of AWS using your face images to improve their AI: AWS Organizations > Policies >
  AI services opt-out policies > attach a policy with `"default": {"opt_out_policy": {"@@assign": "optOut"}}`.
- The app stores only the face vector in Rekognition (no photos are kept on our server).
  Faces are deleted automatically when an employee is marked as left or the face is removed.

## Cost (check the current AWS price page for Mumbai)

Billed per image search, per face stored per month, and (if on) per liveness check.
Monthly searches = employees × working days × 2 (in and out). Example: 50 staff × 26 days × 2 = 2,600 searches.
Liveness, when enabled, adds one check per scan.

## Guided face scan (DetectFaces)

Face enrolment is one guided scan: the screen says look straight, right, left, up, down and takes
each picture by itself. The server checks the head direction of each frame with
`rekognition:DetectFaces` (the `GuidedFaceScan` statement above; it must use `"Resource": "*"`).
Without that permission enrolment still works, but frames are accepted without checking the
direction. Cost: about 5 to 15 DetectFaces calls per enrolment.
