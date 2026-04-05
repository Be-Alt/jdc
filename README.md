# AuthCodex

Starter repo pour :

- frontend `Angular + Tailwind CSS`
- authentification `Google + Neon Auth`
- backend `Vercel Functions`
- base de donnees `Neon Postgres`

Le flux actuel est :

1. Angular lance la connexion Google via Neon Auth
2. Neon Auth cree ou retrouve l'utilisateur
3. Angular recupere l'utilisateur connecte
4. Angular appelle l'API Vercel `/api/profile`
5. L'API valide le domaine email autorise
6. L'API cree ou met a jour `public.profiles` dans Neon
7. L'API signe une session JWT applicative avec :
8. un cookie `HttpOnly` `app_access` de courte duree
9. un cookie `HttpOnly` `app_refresh` de plus longue duree

## Structure

- `src/` : frontend Angular
- `API/src/` : sources TypeScript du backend Vercel
- `API/api/` : fichiers compiles deploiables par Vercel
- `API/sql/` : scripts SQL a executer dans Neon

## Configuration Neon

### 1. Activer Neon Auth

Dans Neon :

1. active `Neon Auth`
2. configure le provider Google
3. configure les domaines autorises pour ton frontend
4. configure le callback OAuth

Exemple local :

```text
http://localhost:4200/auth/callback
```

### 2. Executer le SQL applicatif

Execute [001_auth_profiles.sql](/Users/orel/Documents/Projets/authCodex/API/sql/001_auth_profiles.sql#L1) dans l'editeur SQL Neon.

Ce script cree :

- `public.allowed_email_domains`
- `public.profiles`
- `public.rate_limit_counters`

Il ajoute aussi un domaine autorise par defaut :

```sql
insert into public.allowed_email_domains (domain)
values ('lmottet.be')
on conflict (domain) do nothing;
```

Tu peux ensuite verifier :

```sql
select * from public.allowed_email_domains;
select * from public.profiles order by created_at desc;
```

### 3. Verifier les roles/utilisateurs Neon

Selon le projet Neon, certains roles attendus pour l'auth ou la RLS ne sont pas toujours visibles tout de suite dans l'UI `Connect`.

Dans l'editeur SQL Neon, verifie au minimum :

```sql
select rolname
from pg_roles
where rolname in ('authenticated', 'anonymous', 'neondb_owner');
```

Si `authenticated` et `anonymous` n'existent pas encore et que tu veux reutiliser une strategie RLS plus tard, cree-les :

```sql
create role authenticated;
create role anonymous;
```

Puis accorde les permissions de base :

```sql
grant usage on schema public to authenticated, anonymous;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anonymous;
grant usage, select on all sequences in schema public to authenticated, anonymous;
```

Important :

- le flux `profile` actuel n'a plus besoin du role `authenticated` pour fonctionner
- mais si tu veux reutiliser ce repo avec une vraie verification JWT/RLS backend plus tard, cette etape te fera gagner du temps
- `neondb_owner` reste necessaire pour `DATABASE_URL`

### 4. URL Neon Auth

Dans le frontend, utilise l'endpoint Neon Auth de ta branche, par exemple :

```text
https://ep-xxx.neonauth.c-2.eu-central-1.aws.neon.tech/neondb/auth
```

Le JWKS correspondant sert a Neon/RLS, pas au bouton de login :

```text
https://ep-xxx.neonauth.c-2.eu-central-1.aws.neon.tech/neondb/auth/.well-known/jwks.json
```

## Configuration Vercel

Le projet Vercel doit pointer sur le dossier `API`.

Settings recommandes :

- `Root Directory` : `API`
- `Framework Preset` : `Other`
- `Build Command` : `npm run build`
- `Output Directory` : vide

### Variables d'environnement Vercel

Minimum actuel :

```env
DATABASE_URL=postgresql://...
DATABASE_AUTHENTICATED_URL=postgresql://...
CORS_ALLOW_ORIGIN=http://localhost:4200
APP_JWT_SECRET=une-cle-longue-et-privee
```

Notes :

- `DATABASE_URL` est utilise par l'API pour les lectures/ecritures applicatives
- `DATABASE_AUTHENTICATED_URL` n'est plus critique dans le flux profile actuel, mais peut etre conserve si tu veux reintroduire une verification JWT/RLS plus tard
- `CORS_ALLOW_ORIGIN` doit etre l'origin exacte du frontend
- `APP_JWT_SECRET` sert a signer le JWT backend stocke dans un cookie `HttpOnly`
- la session backend utilise maintenant :
  - `app_access` : courte duree
  - `app_refresh` : refresh transparent cote API
- si ton frontend appelle l'API depuis un autre domaine, garde bien `CORS_ALLOW_ORIGIN` precis et un cookie cross-site compatible

Variables optionnelles utiles :

```env
APP_JWT_COOKIE_SECURE=true
APP_JWT_COOKIE_DOMAIN=
```

- `APP_JWT_COOKIE_SECURE=false` peut aider en debug local si tu ne passes pas par HTTPS, mais laisse `true` des que possible
- `APP_JWT_COOKIE_DOMAIN` est utile si tu veux partager le cookie entre plusieurs sous-domaines

Exemple local :

```env
CORS_ALLOW_ORIGIN=http://localhost:4200
```

Exemple prod :

```env
CORS_ALLOW_ORIGIN=https://app.ton-domaine.be
```

## Configuration Frontend

Le fichier central est [neon-auth.config.ts](/Users/orel/Documents/Projets/authCodex/src/app/neon-auth.config.ts#L1).

Champs a adapter pour un nouveau projet :

```ts
export const neonAuthConfig = {
  appName: 'NomDuProjet',
  apiBaseUrl: 'https://ton-api.vercel.app/api',
  allowedEmailDomains: ['ton-domaine.be'],
  callbackUrl: 'http://localhost:4200/auth/callback',
  neonAuthUrl: 'https://ep-xxx.neonauth.c-2.eu-central-1.aws.neon.tech/neondb/auth',
  supportEmail: 'contact@ton-domaine.be'
};
```

### Champs

- `apiBaseUrl` : base publique de l'API Vercel
- `allowedEmailDomains` : domaines email acceptes par l'app
- `callbackUrl` : URL de retour OAuth
- `neonAuthUrl` : endpoint Neon Auth de la branche

## Demarrage local

### Frontend

```bash
npm install
npm start
```

Frontend local :

```text
http://localhost:4200
```

### API

```bash
cd API
npm install
npm run build
vercel
```

Pour un deploiement prod :

```bash
cd API
vercel --prod
```

## Endpoints utiles

### Types de routes

- `public` : `/api/ping`, `/api/profile`, `/api/logout`
- `authenticated` : `/api/me`
- `role-protected` : `/api/admin-data`, `/api/user-data`, `/api/student-data`

### Rate limiting

Le backend supporte maintenant un rate limiting configurable par route via les wrappers de [api-guards.ts](/Users/orel/Documents/Projets/authCodex/API/src/lib/api-guards.ts#L1).

Exemple :

```ts
withAuthenticatedEndpoint('GET,OPTIONS', handler, {
  rateLimit: {
    name: 'me',
    windowMs: 60_000,
    max: 120,
    key: 'user'
  }
});
```

Clefs possibles :

- `ip` : utile pour les routes publiques
- `user` : utile pour les routes authentifiees
- fonction personnalisee : si tu veux calculer ta propre clef

### Ping DB

```text
GET /api/ping
```

Verifie :

- que Vercel repond
- que les variables sont lues
- que Neon est joignable

Exemple de reponse :

```json
{
  "ok": true,
  "message": "pong",
  "vercel": true,
  "database": {
    "connected": true,
    "name": "neondb",
    "user": "neondb_owner"
  }
}
```

### Sync profil

```text
POST /api/profile
```

Payload attendu :

```json
{
  "userId": "user-id",
  "email": "prenom.nom@ton-domaine.be",
  "name": "Prenom Nom"
}
```

L'endpoint :

1. verifie que l'email appartient a un domaine autorise
2. cree ou met a jour `public.profiles`
3. pose un cookie `HttpOnly` avec le JWT backend

### Session backend

```text
GET /api/me
POST /api/logout
```

- `/api/me` relit la session backend a partir du cookie `HttpOnly`
- si `app_access` a expire mais que `app_refresh` reste valide, l'API renouvelle la session automatiquement
- `/api/logout` efface le cookie backend

## Verification rapide apres clonage

1. configure Neon Auth + Google
2. execute le SQL `API/sql/001_auth_profiles.sql`
3. verifie les roles Neon (`neondb_owner`, et si besoin `authenticated` / `anonymous`)
4. configure les variables Vercel
5. deploie l'API
6. renseigne [neon-auth.config.ts](/Users/orel/Documents/Projets/authCodex/src/app/neon-auth.config.ts#L1)
7. lance le frontend
8. teste `/api/ping`
9. fais un login Google
10. verifie `public.profiles`

## Points d'attention

- `apiBaseUrl` doit pointer vers le bon projet Vercel
- `CORS_ALLOW_ORIGIN` doit correspondre exactement au frontend
- `allowed_email_domains` doit contenir le domaine voulu
- la premiere synchro profil est tentee dans le callback puis a nouveau dans le dashboard
- les routes privees utilisent maintenant le cookie `HttpOnly`, plus `localStorage`
- le bundle Angular depasse actuellement le budget par defaut a cause du SDK auth

## Reutilisation pour un nouveau projet

Pour repartir de cette base :

1. duplique le repo
2. change [neon-auth.config.ts](/Users/orel/Documents/Projets/authCodex/src/app/neon-auth.config.ts#L1)
3. adapte le domaine seed dans [001_auth_profiles.sql](/Users/orel/Documents/Projets/authCodex/API/sql/001_auth_profiles.sql#L1)
4. cree un nouveau projet Vercel sur `API`
5. branche un nouveau projet Neon
6. reconfigure Google OAuth et les callbacks

## Commandes utiles

Frontend :

```bash
npm start
npm run build
```

API :

```bash
cd API
npm run build
vercel
vercel --prod
```
