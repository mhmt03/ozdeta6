import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, ActivityIndicator, Alert, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useEffect, useState } from 'react';
import React from 'react';

import AnaSayfa from './screens/AnaSayfa';
import OgrenciListesi from './screens/ogrenciListesi';
import OgrenciDetay from './screens/OgrenciDetay';
import YeniKayit from './screens/YeniKayit';
import { initDatabase } from './database/init';
import Ajanda from './screens/Ajanda';
import AjandaKayitEkle from './screens/AjandaKayitEkle';
import AjandaRandevuDuzenle from './screens/AjandaRandevuDuzenle';
import DersRapor from './screens/DersRapor';
import NotEkle from './screens/NotEkle';
import OdevEkle from './screens/OdevEkle';
import KaynakYonetimi from './screens/KaynakYonetimi';
import Ayarlar from './screens/Ayarlar';

export type RootStackParamList = {
  ogrenciListesi: undefined;
  yeniKayit: { ogrenci?: any };
  ogrenciDetay: { ogrenci: any };
  AnaSayfa: undefined;
  Ayarlar: undefined;
  NotEkle: { ogrenciId: number };
  OdevEkle: { ogrenciId: number };
  Ajanda: undefined;
  AjandaKayitEkle: undefined;
  AjandaRandevuDuzenle: { randevu: any };
  DersRapor: undefined;
  KaynakYonetimi: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  const [dbInitialized, setDbInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Dosya izinlerini kontrol et ve iste
  const checkAndRequestPermissions = async () => {
    try {
      setPermissionGranted(true);
      return true;
    } catch (error) {
      console.warn('İzin kontrolü hatası:', error);
      setPermissionGranted(true);
      return true;
    }
  };

  useEffect(() => {
    const setupApp = async () => {
      try {
        setLoading(true);

        const hasPermission = await checkAndRequestPermissions();

        if (!hasPermission && Platform.OS === 'android' && Platform.Version < 33) {
          setLoading(false);
          return;
        }

        await initDatabase();
        console.log('Veritabanı başarıyla başlatıldı');
        setDbInitialized(true);

      } catch (error) {
        console.error('Uygulama başlatma hatası:', error);
        Alert.alert(
          'Hata',
          'Uygulama başlatılamadı. Lütfen uygulamayı yeniden başlatın.',
          [{ text: 'Tamam' }]
        );
      } finally {
        setLoading(false);
      }
    };

    setupApp();
  }, []);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Uygulama yükleniyor...</Text>
      </View>
    );
  }

  if (!permissionGranted && Platform.OS === 'android' && Platform.Version < 33) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>⚠️ İzin Gerekli</Text>
        <Text style={styles.infoText}>
          Uygulamanın düzgün çalışması için depolama izni gereklidir.
        </Text>
        <Text style={styles.infoText}>
          Lütfen uygulamayı yeniden başlatın ve izin verin.
        </Text>
      </View>
    );
  }

  if (!dbInitialized) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Veritabanı Hatası</Text>
        <Text style={styles.infoText}>
          Veritabanı başlatılamadı. Lütfen uygulamayı yeniden başlatın.
        </Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator
        initialRouteName='AnaSayfa'
        screenOptions={{
          headerStyle: {
            backgroundColor: '#2196F3',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen
          name='AnaSayfa'
          options={{ title: "Ana Sayfa", headerShown: false }}
          component={AnaSayfa}
        />
        <Stack.Screen
          name='ogrenciListesi'
          options={{ title: "Öğrenci Listesi" }}
          component={OgrenciListesi}
        />
        <Stack.Screen
          name='yeniKayit'
          options={{ title: 'Yeni Öğrenci Kaydı' }}
          component={YeniKayit}
        />
        <Stack.Screen
          name='ogrenciDetay'
          options={{ title: 'Öğrenci Detayları' }}
          component={OgrenciDetay}
        />
        <Stack.Screen
          name='Ajanda'
          component={Ajanda}
        />
        <Stack.Screen
          name='AjandaKayitEkle'
          component={AjandaKayitEkle}
        />
        <Stack.Screen
          name='AjandaRandevuDuzenle'
          component={AjandaRandevuDuzenle}
        />
        <Stack.Screen
          name='DersRapor'
          component={DersRapor}
        />
        <Stack.Screen
          name='NotEkle'
          component={NotEkle}
        />
        <Stack.Screen
          name='OdevEkle'
          component={OdevEkle}
        />
        <Stack.Screen
          name='KaynakYonetimi'
          component={KaynakYonetimi}
        />
        <Stack.Screen
          name='Ayarlar'
          component={Ayarlar}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 22,
    color: '#f44336',
    marginBottom: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  infoText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 20,
  },
});
