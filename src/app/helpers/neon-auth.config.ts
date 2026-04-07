export interface NeonAuthConfig {
  appName: string;
  apiBaseUrl: string;
  allowedEmailDomains: string[];
  callbackUrl: string;
  neonAuthUrl: string;
  supportEmail: string;
}

export const neonAuthConfig: NeonAuthConfig = {
  appName: 'JDC',
  apiBaseUrl: 'https://project-uxxmr.vercel.app/api',
  allowedEmailDomains: ['lmottet.be'],
  callbackUrl: 'http://localhost:4200/auth/callback',
  neonAuthUrl: 'https://ep-tiny-pond-agihrkfg.neonauth.c-2.eu-central-1.aws.neon.tech/neondb/auth',
  supportEmail: 'hello@bealt.be'
};
