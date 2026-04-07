# JDC

Base de depart pour le projet `JDC` avec :

- frontend `Angular + Tailwind CSS`
- authentification `Google + Neon Auth`
- backend `Vercel Functions`
- base de donnees `Neon Postgres`

## Flux actuel

1. Angular lance la connexion Google via Neon Auth.
2. Neon Auth cree ou retrouve l'utilisateur.
3. Le callback frontend recupere la session et l'utilisateur connecte.
4. Le frontend appelle `/api/profile`.
5. L'API valide le domaine email autorise.
6. L'API cree ou met a jour `public.profiles`.
7. L'API cree une session applicative avec cookies `HttpOnly`.

## Configuration actuelle

- app : `JDC`
- frontend local : `http://localhost:4200`
- frontend production : `http://myjdctrack.be`
- callback OAuth : dynamique via `/auth/callback`
- API en ligne : `https://project-uxxmr.vercel.app/api`
- domaine autorise : `lmottet.be`
- endpoint Neon Auth : `https://ep-tiny-pond-agihrkfg.neonauth.c-2.eu-central-1.aws.neon.tech/neondb/auth`

Le fichier central frontend est [neon-auth.config.ts](/Users/orel/Documents/Projets/jdc/src/app/helpers/neon-auth.config.ts).

## Structure

- `src/` : frontend Angular
- `API/src/` : sources TypeScript du backend Vercel
- `API/api/` : fichiers compiles deployables par Vercel
- `API/sql/` : scripts SQL a executer dans Neon

## Base de donnees

Execute [001_auth_profiles.sql](/Users/orel/Documents/Projets/jdc/API/sql/001_auth_profiles.sql) dans Neon.

Ce script cree notamment :

- `public.allowed_email_domains`
- `public.profiles`
- `public.rate_limit_counters`

Il ajoute aussi par defaut le domaine `lmottet.be`.

## Vercel

Le projet Vercel doit pointer sur le dossier `API`.

Reglages recommandes :

- `Root Directory` : `API`
- `Framework Preset` : `Other`
- `Build Command` : `npm run build`
- `Output Directory` : vide

Variables minimales :

```env
DATABASE_URL=postgresql://...
DATABASE_AUTHENTICATED_URL=postgresql://...
CORS_ALLOW_ORIGIN=http://localhost:4200,http://myjdctrack.be,https://myjdctrack.be
APP_JWT_SECRET=une-cle-longue-et-privee
```

Callbacks OAuth a autoriser dans Neon Auth / Google :

- `http://localhost:4200/auth/callback`
- `http://myjdctrack.be/auth/callback`

## Demarrage local

Frontend :

```bash
npm install
npm start
```

API :

```bash
cd API
npm install
npm run build
vercel dev
```

## Test rapide

Ping API en ligne :

```bash
curl https://project-uxxmr.vercel.app/api/ping
```

Le endpoint [ping.ts](/Users/orel/Documents/Projets/jdc/API/src/ping.ts) doit repondre avec :

```json
{
  "ok": true,
  "message": "pong"
}
```

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
6. renseigne [neon-auth.config.ts](/Users/orel/Documents/Projets/jdc/src/app/helpers/neon-auth.config.ts)
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
2. change [neon-auth.config.ts](/Users/orel/Documents/Projets/jdc/src/app/helpers/neon-auth.config.ts)
3. adapte le domaine seed dans [001_auth_profiles.sql](/Users/orel/Documents/Projets/jdc/API/sql/001_auth_profiles.sql)
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
vercel dev
cd ..
vercel --prod
```
