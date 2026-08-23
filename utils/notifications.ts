import * as Notifications from 'expo-notifications';
import { getSetting } from '../database/settingsOperations';
import { ensureDatabaseReady } from '../database/init';
import { Platform } from 'react-native';

/**
 * Uygulamanın yerel bildirim (Local Notification) altyapısını kurar.
 * Bildirimlerin çalacağı ses ve kilit ekranı davranışlarını yönetir.
 */
export async function setupNotificationHandler() {
    // setNotificationHandler, uygulama açıkken (foreground) bildirim geldiğinde 
    // bildirimin nasıl davranacağını (ses, alarm, badge) belirler.
    Notifications.setNotificationHandler({
        handleNotification: async () => {
            // Global ses ayarını veritabanından sorgula (Varsayılan: "1" yani Açık)
            const sound = await getSetting('notification_sound', '1');
            return {
                shouldShowAlert: true,
                shouldPlaySound: sound === '1',
                shouldSetBadge: false,
                // iOS ve modern Android SDK uyumluluğu için gerekli olan yeni görünüm parametreleri:
                shouldShowBanner: true,
                shouldShowList: true,
            };
        },
    });

    // Android için özel bildirim kanalı (Notification Channel) kurulmalıdır.
    // Android 8.0 (API 26) ve sonrasında bildirim kanalı tanımlamak zorunludur.
    if (Platform.OS === 'android') {
        const sound = await getSetting('notification_sound', '1');
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX, // Bildirimin önem derecesi (Ekranda açılır)
            vibrationPattern: [0, 250, 250, 250],            // Titreşim ritmi
            lightColor: '#FF231F7C',
            sound: sound === '1' ? 'default' : undefined,    // Ses dosyası (default veya sessiz)
        });
    }
}

/**
 * Belirli bir randevu / ders için ileri tarihli yerel bildirim planlar (Schedule).
 * 
 * @param ajandaId Randevunun veritabanı ID'si (Bildirim benzersiz ID'si oluşturulurken kullanılır)
 * @param tarih Randevu tarihi (Format: YYYY-MM-DD)
 * @param saat Randevu saati (Format: HH:MM)
 * @param ogrAdsoyad Öğrenci adı soyadı bilgisi (Bildirim içeriğinde gösterilir)
 * @param overrideDakika Opsiyonel: Bildirimin kaç dakika önce çalacağını belirler (Varsayılan: 15 dk)
 * @param overrideSes Opsiyonel: Bildirimin ses durumunu belirler (Varsayılan: Sistem Ayarı)
 * @returns Planlanan bildirimin kimliği (Identifier) veya planlanamadıysa null
 */
export async function scheduleRandevuNotification(
    ajandaId: number,
    tarih: string,
    saat: string,
    ogrAdsoyad: string,
    overrideDakika?: number,
    overrideSes?: boolean
) {
    try {
        // Global bildirim aktif mi ayarını oku (1: Açık, 0: Kapalı)
        const enabled = await getSetting('notifications_enabled', '1');
        if (enabled !== '1') return null;

        // Tarih formatını (YYYY-MM-DD) ve saat formatını (HH:MM) ayrıştır
        const [year, month, day] = tarih.split('-').map(Number);
        const [hour, minute] = saat.split(':').map(Number);
        
        // Yerel saat dilimine göre randevu zamanı nesnesini oluştur
        const appointmentDate = new Date(year, month - 1, day, hour, minute);
        
        // Bildirimin ders vaktinden ne kadar önce tetikleneceğini belirle (dakika cinsinden)
        const minsBefore = overrideDakika !== undefined
            ? overrideDakika
            : (parseInt(await getSetting('notification_minutes', '15')) || 15);
            
        // Tetiklenme zamanını hesapla (Ders Zamanı - Belirlenen Dakika)
        const triggerDate = new Date(appointmentDate.getTime() - minsBefore * 60 * 1000);

        // Eğer hesaplanan bildirim saati geçmiş bir zamana denk geliyorsa planlama yapma
        if (triggerDate.getTime() <= Date.now()) {
            return null;
        }

        // Eğer bu randevuya ait eski bir planlanmış bildirim varsa çakışmayı önlemek için temizle
        await cancelRandevuNotification(ajandaId);

        const vibrate = (await getSetting('notification_vibrate', '1')) === '1';
        const sound = overrideSes !== undefined
            ? overrideSes
            : (await getSetting('notification_sound', '1')) === '1';

        // scheduleNotificationAsync, Expo'ya arka planda çalışacak bir alarm kurar.
        const identifier = await Notifications.scheduleNotificationAsync({
            identifier: `randevu-${ajandaId}`, // Benzersiz bildirim belirteci
            content: {
                title: 'Yaklaşan Ders Randevusu',
                body: `${saat} saatinde ${ogrAdsoyad} ile dersiniz yaklaşıyor.`,
                sound: sound,
                vibrate: vibrate ? [0, 250, 250, 250] : undefined,
                data: { ajandaId }, // Bildirime tıklandığında okunabilecek meta veri
                // @ts-ignore - Expo Notifications TypeScript versiyon uyuşmazlığı bypass'ı
                android: {
                    channelId: 'default', // Android kanal eşleşmesi
                }
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: triggerDate, // Bildirimin tetikleneceği Date nesnesi
            },
        });

        return identifier;
    } catch (error) {
        console.error(`Randevu (${ajandaId}) bildirimi planlanamadı:`, error);
        return null;
    }
}

/**
 * Planlanmış belirli bir dersin bildirimini iptal eder.
 * 
 * @param ajandaId İptal edilecek randevunun ID'si
 */
export async function cancelRandevuNotification(ajandaId: number) {
    try {
        // Expo altyapısından bu ID ile planlanmış bildirimi sil
        await Notifications.cancelScheduledNotificationAsync(`randevu-${ajandaId}`);
    } catch (e) {
        // Bildirim zaten tetiklenmiş veya bulunamamış olabilir, hatayı bastır
    }
}

/**
 * Veritabanındaki tüm aktif randevuları tarar ve bildirimlerini sıfırdan yeniden planlar.
 * Uygulama ayarlarında bildirim dakikası veya ses değiştiğinde bu fonksiyon tetiklenir.
 */
export async function rescheduleAllRandevuNotifications() {
    try {
        const enabled = await getSetting('notifications_enabled', '1');
        
        // Önceki tüm planlanmış bildirimleri temizle
        await Notifications.cancelAllScheduledNotificationsAsync();
        
        // Eğer bildirimler tamamen kapalıysa yeni planlama yapma
        if (enabled !== '1') {
            return;
        }

        const db = await ensureDatabaseReady();
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Bugünden sonraki, iptal edilmemiş ve tamamlanmamış tüm ders programını getir
        const rows = await db.getAllAsync<any>(
            `SELECT ajandaId, tarih, saat, ogrAdsoyad 
             FROM ajanda 
             WHERE tarih >= ? AND iptal != 1 AND tamamlandiMi != 1 AND tamamlanma != '1' AND sutun1 != 'tamamlandı'`,
            [todayStr]
        );

        // Her aktif randevu için tek tek alarm kur
        for (const row of rows) {
            await scheduleRandevuNotification(row.ajandaId, row.tarih, row.saat, row.ogrAdsoyad);
        }
        console.log(`${rows.length} randevu bildirimi yeniden planlandı.`);
    } catch (error) {
        console.error('Bildirimler yeniden yapılandırılırken hata:', error);
    }
}
