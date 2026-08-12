import * as Notifications from 'expo-notifications';
import { getSetting } from '../database/settingsOperations';
import { ensureDatabaseReady } from '../database/init';
import { Platform } from 'react-native';

// Global bildirim yöneticisi kurulumu
export async function setupNotificationHandler() {
    Notifications.setNotificationHandler({
        handleNotification: async () => {
            const sound = await getSetting('notification_sound', '1');
            return {
                shouldShowAlert: true,
                shouldPlaySound: sound === '1',
                shouldSetBadge: false,
            };
        },
    });

    if (Platform.OS === 'android') {
        const sound = await getSetting('notification_sound', '1');
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
            sound: sound === '1' ? 'default' : undefined,
        });
    }
}

// Belirli bir randevu için bildirim planla
export async function scheduleRandevuNotification(
    ajandaId: number,
    tarih: string,
    saat: string,
    ogrAdsoyad: string
) {
    try {
        const enabled = await getSetting('notifications_enabled', '1');
        if (enabled !== '1') return null;

        // Tarih formatı: YYYY-MM-DD, Saat formatı: HH:MM
        const [year, month, day] = tarih.split('-').map(Number);
        const [hour, minute] = saat.split(':').map(Number);
        
        // Randevu zamanını oluştur (Yerel saat diliminde)
        const appointmentDate = new Date(year, month - 1, day, hour, minute);
        
        const minsBefore = parseInt(await getSetting('notification_minutes', '15')) || 15;
        const triggerDate = new Date(appointmentDate.getTime() - minsBefore * 60 * 1000);

        // Eğer bildirim zamanı geçmişte ise planlama yapma
        if (triggerDate.getTime() <= Date.now()) {
            return null;
        }

        // Varsa eski bildirimi temizle
        await cancelRandevuNotification(ajandaId);

        const vibrate = (await getSetting('notification_vibrate', '1')) === '1';
        const sound = (await getSetting('notification_sound', '1')) === '1';

        const identifier = await Notifications.scheduleNotificationAsync({
            identifier: `randevu-${ajandaId}`,
            content: {
                title: 'Yaklaşan Ders Randevusu',
                body: `${saat} saatinde ${ogrAdsoyad} ile dersiniz yaklaşıyor.`,
                sound: sound,
                vibrate: vibrate ? [0, 250, 250, 250] : undefined,
                data: { ajandaId },
                android: {
                    channelId: 'default',
                }
            },
            trigger: triggerDate,
        });

        return identifier;
    } catch (error) {
        console.error(`Randevu (${ajandaId}) bildirimi planlanamadı:`, error);
        return null;
    }
}

// Belirli bir randevunun bildirimini iptal et
export async function cancelRandevuNotification(ajandaId: number) {
    try {
        await Notifications.cancelScheduledNotificationAsync(`randevu-${ajandaId}`);
    } catch (e) {
        // Hata bastırılıyor, eğer bulunamazsa expo hata verebilir
    }
}

// Tüm randevuların bildirimlerini yeniden planla
export async function rescheduleAllRandevuNotifications() {
    try {
        const enabled = await getSetting('notifications_enabled', '1');
        
        // Tüm planlanmış bildirimleri sıfırla
        await Notifications.cancelAllScheduledNotificationsAsync();
        
        if (enabled !== '1') {
            return;
        }

        const db = await ensureDatabaseReady();
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Aktif, tamamlanmamış ve bugünden sonraki randevuları getir
        const rows = await db.getAllAsync<any>(
            `SELECT ajandaId, tarih, saat, ogrAdsoyad 
             FROM ajanda 
             WHERE tarih >= ? AND iptal != 1 AND tamamlandiMi != 1 AND tamamlanma != '1' AND sutun1 != 'tamamlandı'`,
            [todayStr]
        );

        for (const row of rows) {
            await scheduleRandevuNotification(row.ajandaId, row.tarih, row.saat, row.ogrAdsoyad);
        }
        console.log(`${rows.length} randevu bildirimi yeniden planlandı.`);
    } catch (error) {
        console.error('Bildirimler yeniden yapılandırılırken hata:', error);
    }
}
