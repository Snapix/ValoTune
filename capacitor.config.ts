import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.snapix.valotune',
  appName: 'ValoTune',
  webDir: 'dist',
  backgroundColor: '#0a0a0c',
  android: {
    allowMixedContent: false,
    captureInput: true,
  },
  server: {
    androidScheme: 'https',
    allowNavigation: ['valotune.vercel.app'],
  },
};

export default config;
