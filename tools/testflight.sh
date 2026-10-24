#!/bin/sh
# Construit l'app iPhone et l'envoie sur TestFlight. Le numéro de build est l'heure (toujours croissant).
# Clé d'API App Store Connect : ~/.appstoreconnect/private_keys/AuthKey_P2DPLW2SRN.p8
set -e
cd "$(dirname "$0")/.."
K="$HOME/.appstoreconnect/private_keys/AuthKey_P2DPLW2SRN.p8"
AUTH="-allowProvisioningUpdates -authenticationKeyPath $K -authenticationKeyID P2DPLW2SRN -authenticationKeyIssuerID fb365280-db5a-48bb-84b3-98ae481c1235"
BUILD=$(date +%Y%m%d%H%M)
npm run build
npx cap sync ios
rm -rf /tmp/rature-archive.xcarchive /tmp/rature-export
cd ios/App
xcodebuild -project App.xcodeproj -scheme App -configuration Release -destination "generic/platform=iOS" \
  -archivePath /tmp/rature-archive.xcarchive CURRENT_PROJECT_VERSION="$BUILD" $AUTH archive | grep -E "error|ARCHIVE" || true
cat > /tmp/rature-export.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>AKMNXGVVGX</string>
  <key>destination</key><string>upload</string>
  <key>signingStyle</key><string>automatic</string>
</dict></plist>
PLIST
# destination=upload : l'export envoie directement l'archive à App Store Connect (TestFlight)
xcodebuild -exportArchive -archivePath /tmp/rature-archive.xcarchive -exportOptionsPlist /tmp/rature-export.plist \
  -exportPath /tmp/rature-export $AUTH | grep -E "error|EXPORT|Upload|upload" || true
echo "build $BUILD"
