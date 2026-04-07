import { createAuthClient } from '@neondatabase/neon-js/auth';
import { neonAuthConfig } from './neon-auth.config';

export const neonAuthClient = createAuthClient(neonAuthConfig.neonAuthUrl);
