#!/usr/bin/env bash
# Creates the Android release signing key ONCE and prints the values to paste into
# GitHub -> repository Settings -> Secrets and variables -> Actions -> New repository secret.
# Keep the .jks file and passwords safe (password manager). If the key is lost, users must
# uninstall and reinstall the app to get updates.
set -euo pipefail

OUT="${1:-s-lab-hrms-release.jks}"
ALIAS="s-lab-hrms"
if [ -e "$OUT" ]; then echo "$OUT already exists. Refusing to overwrite."; exit 1; fi
command -v keytool >/dev/null || { echo "keytool not found. Install Java (JDK 17+)."; exit 1; }

PASS="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)"
keytool -genkeypair -v -keystore "$OUT" -alias "$ALIAS" -keyalg RSA -keysize 4096 -validity 10000 \
  -storepass "$PASS" -keypass "$PASS" -dname "CN=S-Lab HRMS, O=S-Lab, C=IN" >/dev/null

echo
echo "Created $OUT. Add these four GitHub secrets:"
echo
echo "ANDROID_KEYSTORE_PASSWORD = $PASS"
echo "ANDROID_KEY_PASSWORD      = $PASS"
echo "ANDROID_KEY_ALIAS         = $ALIAS"
echo "ANDROID_KEYSTORE_BASE64   = (contents of ${OUT}.base64, created now)"
base64 -w0 "$OUT" > "${OUT}.base64" 2>/dev/null || base64 -i "$OUT" -o "${OUT}.base64"
echo
echo "Then delete ${OUT}.base64 and store $OUT and the password somewhere safe."
