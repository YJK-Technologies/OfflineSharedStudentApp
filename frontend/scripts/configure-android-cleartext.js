/**
 * Automatically configures AndroidManifest.xml after `npx cap sync`
 * 1. Adds android:usesCleartextTraffic="true" (required by Android 9+ to call http://192.168.x.x:5000)
 * 2. Ensures INTERNET and ACCESS_NETWORK_STATE permissions are present
 */

const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

if (!fs.existsSync(manifestPath)) {
  console.log('[Android Config] android/ folder not generated yet. Skipping AndroidManifest.xml patch.');
  console.log('[Android Config] Run "npx cap add android" first, then "npm run cap:sync".');
  process.exit(0);
}

let xml = fs.readFileSync(manifestPath, 'utf-8');
let modified = false;

// 1. Add android:usesCleartextTraffic="true" to <application>
if (!xml.includes('android:usesCleartextTraffic')) {
  xml = xml.replace(
    /<application\b/,
    '<application\n        android:usesCleartextTraffic="true"'
  );
  modified = true;
  console.log('[Android Config] Added android:usesCleartextTraffic="true" to AndroidManifest.xml');
} else if (xml.includes('android:usesCleartextTraffic="false"')) {
  xml = xml.replace('android:usesCleartextTraffic="false"', 'android:usesCleartextTraffic="true"');
  modified = true;
  console.log('[Android Config] Updated android:usesCleartextTraffic to "true"');
}

// 2. Ensure INTERNET permission
if (!xml.includes('android.permission.INTERNET')) {
  xml = xml.replace(
    /<manifest\b([^>]*)>/,
    '<manifest$1>\n    <uses-permission android:name="android.permission.INTERNET" />'
  );
  modified = true;
  console.log('[Android Config] Added INTERNET permission');
}

// 3. Ensure ACCESS_NETWORK_STATE permission
if (!xml.includes('android.permission.ACCESS_NETWORK_STATE')) {
  xml = xml.replace(
    /<manifest\b([^>]*)>/,
    '<manifest$1>\n    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />'
  );
  modified = true;
  console.log('[Android Config] Added ACCESS_NETWORK_STATE permission');
}

if (modified) {
  fs.writeFileSync(manifestPath, xml, 'utf-8');
  console.log('[Android Config] AndroidManifest.xml saved successfully.');
} else {
  console.log('[Android Config] AndroidManifest.xml already configured for LAN HTTP traffic.');
}
