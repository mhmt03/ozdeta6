import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
// Uyumsuzluk ve TypeScript derleme hatalarını önlemek için expo-file-system/legacy alt modülü kullanılır.
// Bu yol, modern Expo SDK sürümlerinde eski API'leri kararlı şekilde kullanmaya olanak tanır.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

// Otomatik yedekleme sıklığı (varsayılan)
const DEFAULT_BACKUP_INTERVAL_DAYS = 14;
// Son otomatik yedekleme tarihini depolamak için kullanılan AsyncStorage anahtarı
const LAST_BACKUP_KEY = '@last_auto_backup_date';
const BACKUP_ENABLED_KEY = '@backup_reminder_enabled';
const BACKUP_INTERVAL_KEY = '@backup_reminder_interval';
// Takip edilen veritabanı dosya adı
const DATABASE_NAME = 'ozdeta.db';

/**
 * Otomatik yedekleme vaktinin gelip gelmediğini kontrol eder.
 * Eğer en son yedeklemeden bu yana belirlenen gün geçmişse kullanıcıya bir uyarı penceresi (Alert) gösterir.
 */
export const checkAutomaticBackup = async () => {
    try {
        const enabledStr = await AsyncStorage.getItem(BACKUP_ENABLED_KEY);
        if (enabledStr === 'false') {
            return; // Hatırlatıcı kapalı
        }

        const intervalStr = await AsyncStorage.getItem(BACKUP_INTERVAL_KEY);
        const intervalDays = intervalStr ? parseInt(intervalStr, 10) : DEFAULT_BACKUP_INTERVAL_DAYS;

        // Cihazın yerel depolama alanından son otomatik yedekleme tarihini oku
        const lastBackupStr = await AsyncStorage.getItem(LAST_BACKUP_KEY);
        const now = new Date();

        if (lastBackupStr) {
            const lastBackupDate = new Date(lastBackupStr);
            // İki tarih arasındaki milisaniye cinsinden farkı hesapla
            const diffTime = Math.abs(now.getTime() - lastBackupDate.getTime());
            // Milisaniyeyi gün sayısına dönüştür (Yuvarlayarak)
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Eğer fark belirlenen periyoda eşit veya büyükse yedekleme teklif et
            if (diffDays >= intervalDays) {
                promptForBackup(now);
            }
        } else {
            // İlk kez kurulduğunda hemen yedekleme sormaması için bugünün tarihini kaydet.
            await AsyncStorage.setItem(LAST_BACKUP_KEY, now.toISOString());
        }
    } catch (error) {
        console.error('Otomatik yedekleme kontrol hatası:', error);
    }
};

/**
 * Kullanıcıya veritabanını yedeklemek isteyip istemediğini soran bir onay penceresi açar.
 * 
 * @param currentDate Yedekleme işleminin yapılacağı tarih referansı
 */
const promptForBackup = (currentDate: Date) => {
    Alert.alert(
        "Otomatik Yedekleme Zamanı",
        "Veri güvenliğiniz için veritabanınızın yedeğini almanız önerilir. Lütfen açılan ekranda yedek dosyasını güvenli bir konuma kaydedin.",
        [
            { text: "Sonra Hatırlat", style: "cancel" },
            { 
                text: "Yedekle", 
                onPress: async () => {
                    await performBackup(currentDate);
                } 
            }
        ],
        { cancelable: false } // Kullanıcı dışarı tıklayarak pencereyi kapatamaz, seçim yapmalıdır.
    );
};

/**
 * Yedekleme işlemini gerçekleştiren ana asenkron fonksiyon.
 * Veritabanını geçici klasöre kopyalar ve paylaşım arayüzünü (Sharing API) tetikler.
 * 
 * @param currentDate Yedekleme yapılan tarih
 */
const performBackup = async (currentDate: Date) => {
    try {
        // SQLite veritabanı dosyasının yerel cihazdaki konumu (documentDirectory/SQLite/)
        // @ts-ignore - expo-file-system legacy typings bypass
        const dbDir = `${FileSystem.documentDirectory}SQLite`;
        const dbPath = `${dbDir}/${DATABASE_NAME}`;
        
        // Veritabanı dosyasının gerçekten var olup olmadığını kontrol et
        const fileInfo = await FileSystem.getInfoAsync(dbPath);
        if (!fileInfo.exists) {
            console.log('Veritabanı dosyası bulunamadı:', dbPath);
            return;
        }

        // Dosya adı için tarih formatı oluştur (Örn: 2026-08-22)
        const dateStr = currentDate.toISOString().split('T')[0];
        // Paylaşım için geçici cache dizininde yedek dosyası oluştur
        // @ts-ignore - expo-file-system legacy typings bypass
        const tempPath = `${FileSystem.cacheDirectory}ozdeta_yedek_${dateStr}.db`;
        
        // Asıl veritabanı dosyasını geçici alana kopyala
        await FileSystem.copyAsync({
            from: dbPath,
            to: tempPath
        });

        // Cihazda dosya paylaşım özelliğinin aktif olup olmadığını kontrol et (iOS/Android uyumluluğu)
        if (await Sharing.isAvailableAsync()) {
            // Sharing.shareAsync yerel paylaşım sayfasını açar. 
            // Kullanıcı bu pencereden dosyayı kaydedebilir veya WhatsApp/Mail ile gönderebilir.
            await Sharing.shareAsync(tempPath, {
                mimeType: 'application/x-sqlite3',
                dialogTitle: 'Veritabanı Yedeğini Kaydet'
            });
            // İşlem başarıyla sunulunca son yedekleme zamanını güncelle
            await AsyncStorage.setItem(LAST_BACKUP_KEY, currentDate.toISOString());
        } else {
            Alert.alert("Hata", "Paylaşım/Kaydetme özelliği cihazınızda desteklenmiyor.");
        }
    } catch (error) {
        console.error("Yedekleme sırasında hata:", error);
        Alert.alert("Hata", "Yedekleme sırasında bir sorun oluştu.");
    }
};
