import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'be.bealt.jdc.mobile',
  appName: 'JDC Mobile',
  webDir: 'www/browser',
  bundledWebRuntime: false,
  ios: {
    contentInset: 'automatic'
  }
};

export default config;
