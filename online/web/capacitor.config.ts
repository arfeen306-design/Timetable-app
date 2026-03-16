import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.schedulr.app',
  appName: 'Schedulr',
  webDir: 'dist',
  server: {
    // Point to your live Railway backend
    url: 'https://timetable-api-production-9ad4.up.railway.app',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0F172A',
  },
  android: {
    backgroundColor: '#0F172A',
  },
};

export default config;
