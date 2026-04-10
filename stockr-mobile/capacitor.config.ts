import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stockr.app',
  appName: 'Stockr',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
