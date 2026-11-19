# Stockr

Gestion de stock, commandes et ventes. Trois morceaux, tous dans ce dépôt :

| Dossier | Contenu |
|---|---|
| `stockr-backend/` | Serveur Next.js (App Router) + API + interface web, base SQLite via Prisma. Publié en image Docker. |
| `stockr-mobile/` | Appli Android (React + Vite + Capacitor), scan de codes-barres natif (Google ML Kit). |
| `n8n/` | Les workflows n8n qui alimentent Stockr (commandes Amazon par mail, suivi des colis La Poste). |

Ce document permet de tout reconstruire : serveur, APK, automatisations.

## 1. Serveur (`stockr-backend`)

### En local (développement)

Prérequis : Node 20+.

```bash
cd stockr-backend
cp .env.example .env        # puis éditer (voir variables ci-dessous)
npm ci
npx prisma migrate deploy   # crée/migre la base SQLite
npm run dev                 # http://localhost:3000
```

### Variables d'environnement

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Chemin SQLite. Dev : `file:./prisma/dev.db`. Docker : `file:/app/data/stockr.db`. |
| `SESSION_SECRET` | Secret de session, 64 caractères aléatoires. **À changer en production.** |
| `COOKIE_SECURE` | `true` derrière HTTPS (production), `false` en HTTP local. |
| `N8N_API_KEY` | Clé que n8n envoie dans l'en-tête `X-API-Key` (ou `Authorization: Bearer`). Sans elle, les appels n8n sont refusés. |

La clé `N8N_API_KEY` du serveur et celle écrite dans les nœuds HTTP de n8n doivent être identiques.

### Production (Docker)

1. Chaque push sur `main` qui touche `stockr-backend/` déclenche `.github/workflows/docker-publish.yml` : vérification TypeScript, build, publication de `ghcr.io/patator33/stockr:latest`.
2. Sur le serveur, lancer la stack avec `stockr-backend/docker-compose.yml` (variables `SESSION_SECRET`, `COOKIE_SECURE`, `N8N_API_KEY`, `PORT_EXTERNAL` à fournir). La base vit dans le volume `stockr_data` (`/app/data`).
3. Mettre à jour = re-tirer l'image `latest` et recréer le conteneur (Portainer ou Watchtower). Les migrations Prisma s'exécutent au démarrage (`entrypoint.sh`).

Le workflow GitHub contient aussi une étape optionnelle qui appelle un webhook Portainer (secret `PORTAINER_WEBHOOK_URL`) : inutile si Portainer n'est pas joignable depuis Internet.

### Fonctions à connaître

- **Sauvegarde automatique SMB** : Réglages > Sauvegarde automatique (admin). Snapshot SQLite envoyé sur un partage Samba, `smbclient` est installé dans l'image.
- **Webhooks** : Réglages. URL « nouvelle commande », et URL « relance expédition ».
- **Relance d'expédition à 16h** : l'endpoint `GET /api/cron/shipping-reminder` (en-tête `X-API-Key`) envoie le webhook de relance pour chaque commande non expédiée dont la date limite est aujourd'hui. Il faut le déclencher chaque jour à 16h : dans n8n, un nœud *Schedule Trigger* puis un nœud *HTTP Request* GET vers cette URL. (Ce workflow n'est pas fourni dans `n8n/` : il n'existait pas au moment de l'export.)
- **Suivi de livraison** : `POST /api/orders/tracking-update` (clé API), appelé par le workflow n8n Colissimo.

## 2. Application Android (`stockr-mobile`)

Prérequis (Windows) : **Node 20+**, **JDK 17** (le JDK livré avec Android Studio convient), **Android SDK** plateforme 34 (installé par Android Studio). Gradle est téléchargé automatiquement par le wrapper.

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1
```

Le script détecte le JDK et le SDK, crée `android/local.properties` (propre à chaque machine, non versionné), puis lance `npm ci`, `npm run build`, `npx cap sync android` et `gradlew assembleDebug`. Résultat : `stockr.apk` à la racine.

Les étapes à la main, si besoin :

```bash
cd stockr-mobile
npm ci
npm run build                 # tsc + vite -> dist/
npx cap sync android          # copie dist/ et les plugins dans android/
cd android && ./gradlew assembleDebug
# APK : android/app/build/outputs/apk/debug/app-debug.apk
```

### Installer sur un téléphone

Débogage sans fil activé sur le téléphone, puis :

```bash
adb devices -l
adb -s <serial> install -r stockr.apk
```

Avec plusieurs appareils (ou une entrée « emulator » hors ligne), toujours viser le serial avec `-s`.

### Au premier lancement

Renseigner l'adresse du serveur (ex. `https://stockr.exemple.fr`) puis se connecter.

### Signature : à lire avant de reconstruire

Les APK sont signés avec la **clé de debug de la machine qui les a construits** (`%USERPROFILE%\.android\debug.keystore`). Android refuse de mettre à jour une appli installée si la nouvelle APK n'est pas signée avec la même clé (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`). Pour pouvoir installer par-dessus les appareils existants depuis une autre machine, il faut y copier ce fichier `debug.keystore`. Sinon, désinstaller l'appli sur le téléphone avant : seuls l'adresse du serveur et la session sont perdues, les données sont sur le serveur.

Cette clé n'est volontairement **pas** dans le dépôt, qui est public.

### Icônes

Déjà générées dans `android/app/src/main/res/`. Pour les refaire depuis `emoji-box.png` : `node generate-icons.mjs` (dans `stockr-mobile/`, utilise `sharp`).

### Détails techniques

- `appId` : `com.stockr.app`, `minSdkVersion` 23 (exigé par ML Kit), `compileSdk` 34.
- Scanner : plugin `@capacitor-mlkit/barcode-scanning` (écran de scan Google ; le module est téléchargé par Android au premier usage). Repli sur `html5-qrcode` si indisponible.
- Pour une version « release » signée avec une clé dédiée, il faut ajouter une `signingConfig` dans `android/app/build.gradle` : non fait à ce jour.

## 3. Automatisations n8n (`n8n/`)

Deux workflows, à importer dans n8n (*Workflows > Import from file*) :

| Fichier | Rôle |
|---|---|
| `amazon-orders.workflow.json` | Lit les mails Amazon « Commande à expédier », extrait SKU, quantité et date limite, crée la commande dans Stockr (`POST /api/orders`), marque le mail lu et prévient la personne qui expédie. |
| `colissimo-tracking.workflow.json` | Lit les mails Colissimo (déposé / en transit / livré) et met à jour le statut de livraison de la commande (`POST /api/orders/tracking-update`). |

Après import, à adapter :

- Recréer le **credential Gmail OAuth2** et le sélectionner dans les nœuds Gmail.
- Remplacer `https://VOTRE-DOMAINE-STOCKR` par l'adresse du serveur.
- Remplacer `REMPLACER_PAR_LA_CLE_N8N_API_KEY` par la valeur de `N8N_API_KEY` du serveur. (Mieux : un credential n8n de type *Header Auth*.)
- Remplacer `EXPEDITEUR@example.com` / `ADMIN@example.com` par les vraies adresses.
- Activer les workflows.

Notes de fonctionnement :

- Le mail Amazon n'a qu'une partie HTML : le code décode `&nbsp;` et les autres entités avant d'extraire les champs. Le SKU Amazon est envoyé comme `supplierRef` ; le serveur retrouve le vrai nom de la variante, il ne faut donc pas envoyer de `variantName` quand un SKU est présent.
- Le suivi rattache le mail à la commande par **numéro de suivi exact** (espaces et casse ignorés) : le numéro doit avoir été saisi ou scanné sur la commande à l'expédition. Un colis déjà « livré » ne revient pas en arrière.
- Les workflows ne rattrapent pas les anciens mails : ils traitent ceux reçus après leur activation.
