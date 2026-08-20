import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const BACKUP_INTERVAL_DAYS = 14;
const LAST_BACKUP_KEY = '@last_auto_backup_date';
const DATABASE_NAME = 'ozdeta.db'; // Varsayılan SQLite DB ismi

export const checkAutomaticBackup = async () => {
    try {
        const lastBackupStr = await AsyncStorage.getItem(LAST_BACKUP_KEY);
        const now = new Date();

        if (lastBackupStr) {
            const lastBackupDate = new Date(lastBackupStr);
            const diffTime = Math.abs(now.getTime() - lastBackupDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays >= BACKUP_INTERVAL_DAYS) {
                promptForBackup(now);
            }
        } else {
            // İlk kez açıldığında, 14 gün sonrasını referans alması için bugünü kaydedelim.
            // Aksi halde yeni kurulumda hemen yedek sorar.
            await AsyncStorage.setItem(LAST_BACKUP_KEY, now.toISOString());
        }
    } catch (error) {
        console.error('Otomatik yedekleme kontrol hatası:', error);
    }
};

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
        { cancelable: false }
    );
};

const performBackup = async (currentDate: Date) => {
    try {
        const dbDir = `${FileSystem.documentDirectory}SQLite`;
        const dbPath = `${dbDir}/${DATABASE_NAME}`;
        
        const fileInfo = await FileSystem.getInfoAsync(dbPath);
        if (!fileInfo.exists) {
            console.log('Veritabanı dosyası bulunamadı:', dbPath);
            return;
        }

        const dateStr = currentDate.toISOString().split('T')[0];
        const tempPath = `${FileSystem.cacheDirectory}ozdeta_yedek_${dateStr}.db`;
        
        await FileSystem.copyAsync({
            from: dbPath,
            to: tempPath
        });

        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(tempPath, {
                mimeType: 'application/x-sqlite3',
                dialogTitle: 'Veritabanı Yedeğini Kaydet'
            });
            // Kullanıcı dialogu gördükten sonra zamanı güncelliyoruz.
            await AsyncStorage.setItem(LAST_BACKUP_KEY, currentDate.toISOString());
        } else {
            Alert.alert("Hata", "Paylaşım/Kaydetme özelliği cihazınızda desteklenmiyor.");
        }
    } catch (error) {
        console.error("Yedekleme sırasında hata:", error);
        Alert.alert("Hata", "Yedekleme sırasında bir sorun oluştu.");
    }
};
