const fs = require('fs');
const path = require('path');

// Dosya yolları
const appJsonPath = path.join(__dirname, 'app.json');
const pkgJsonPath = path.join(__dirname, 'package.json');

// app.json ve package.json dosyalarını oku
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

// Mevcut versiyonu al (örneğin: "1.0.0")
const currentVersion = appJson.expo.version;

// Versiyon numarasını noktalardan böl (SemVer standardı: MAJOR.MINOR.PATCH)
// Örneğin: "1.0.0" -> [1, 0, 0]
let versionParts = currentVersion.split('.').map(Number);

// Son rakamı (PATCH) 1 artır.
// Eğer versiyon formatı sadece "1.0" ise (yani 2 parçaysa), sonuncuyu artırır.
versionParts[versionParts.length - 1] += 1;

// Yeni versiyonu birleştir (Örn: "1.0.1")
const newVersion = versionParts.join('.');

console.log(`Versiyon artırılıyor: ${currentVersion} -> ${newVersion}`);

// app.json içindeki versiyonu güncelle
appJson.expo.version = newVersion;

// Android versionCode varsa artır, yoksa 1 olarak başlat (Market güncellemeleri için zorunludur)
if (!appJson.expo.android) appJson.expo.android = {};
appJson.expo.android.versionCode = (appJson.expo.android.versionCode || 1) + 1;

// iOS buildNumber varsa artır, yoksa "1" olarak başlat
if (!appJson.expo.ios) appJson.expo.ios = {};
const iosBuildNumber = parseInt(appJson.expo.ios.buildNumber || "1") + 1;
appJson.expo.ios.buildNumber = iosBuildNumber.toString();

// package.json güncellemesi
pkgJson.version = newVersion;

// Değişiklikleri dosyalara kaydet
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));
fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));

console.log(`✅ Sürüm başarıyla güncellendi! Yeni app.json sürümü: ${newVersion}, Android versionCode: ${appJson.expo.android.versionCode}`);
