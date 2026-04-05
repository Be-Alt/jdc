export interface NeonAuthConfig {
  appName: string;
  apiBaseUrl: string;
  allowedEmailDomains: string[];
  callbackUrl: string;
  neonAuthUrl: string;
  supportEmail: string;
}

export const neonAuthConfig: NeonAuthConfig = {
  appName: 'AuthCodex',
  apiBaseUrl: 'https://project-5td5a.vercel.app/api',
  allowedEmailDomains: ['lmottet.be'],
  callbackUrl: 'http://localhost:4200/auth/callback',
  neonAuthUrl: 'https://ep-spring-dawn-agb6cndi.neonauth.c-2.eu-central-1.aws.neon.tech/neondb/auth',
  supportEmail: 'support@authcodex.dev'
};
