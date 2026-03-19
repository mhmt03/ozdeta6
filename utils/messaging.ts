import * as Linking from 'expo-linking';
import * as SMS from 'expo-sms';
import { Alert } from 'react-native';

/**
 * SMS gönderme
 * @param phone Öğrenci telefon numarası
 * @param mesaj Gönderilecek mesaj
 */
export const sendSMS = async (phone: string, mesaj: string): Promise<void> => {
    try {
        const isAvailable = await SMS.isAvailableAsync();
        if (isAvailable) {
            await SMS.sendSMSAsync([phone], mesaj);
        } else {
            Alert.alert('Hata', 'SMS gönderilemiyor! Cihaz desteklemiyor.');
        }
    } catch (error) {
        console.error("SMS gönderme hatası:", error);
    }
};

/**
 * WhatsApp mesaj gönderme
 * @param phone Öğrenci telefon numarası
 * @param mesaj Gönderilecek mesaj
 */
export const sendWhatsApp = (phone: string, mesaj: string): void => {
    // Remove formatting characters from the phone number
    const formattedPhone = phone.replace(/\D/g, '');
    const url = `whatsapp://send?phone=${formattedPhone}&text=${encodeURIComponent(mesaj)}`;

    Linking.canOpenURL(url)
        .then((supported) => {
            if (!supported) {
                Alert.alert('Hata', 'WhatsApp cihazınızda yüklü değil!');
            } else {
                return Linking.openURL(url);
            }
        })
        .catch((err) => console.error('WhatsApp açma hatası:', err));
};
