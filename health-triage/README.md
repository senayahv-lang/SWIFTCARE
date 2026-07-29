# Health Triage — Malaria & Fever (Hackathon)

WHO-aligned, **offline-first** web app for community malaria and fever triage. Supports **English, Twi, French, and Spanish**. When malaria is detected as **positive**, the system sends a **privacy-preserving alert** to a pharmacist or doctor.

## Features

- **Malaria triage** — RDT test-treat-track flow (WHO Malaria Guidelines 2023)
- **Other diseases tab** — Unlocks when RDT is **negative** (dengue, typhoid, influenza, UTI, pneumonia — IMCI-aligned)
- **Offline PWA** — Works without internet; sessions queue locally and sync when online
- **Clinician alerts** — Email notification on malaria positive (no patient names in messages)
- **Privacy-focused admin** — Pseudonymous patient refs only; JWT-protected dashboard
- **Multilingual** — EN / Twi / FR / ES

## Tech stack

| Layer    | Stack                                      |
|----------|--------------------------------------------|
| Frontend | React 18, Vite, Tailwind, PWA (Workbox)   |
| Backend  | Node.js, Express, SQLite (better-sqlite3) |
| Auth     | JWT + bcrypt (admin only)                 |

## Prerequisites

- **Node.js 20+** and npm
- Optional: SMTP credentials for real email alerts

## Quick start (development)

```bash
# 1. Clone / enter project
cd health-triage

# 2. Install all dependencies
npm run install:all

# 3. Configure server (optional — defaults work for demo)
cp server/.env.example server/.env
# Edit server/.env — change ADMIN_PASSWORD and JWT_SECRET for production

# 4. Run client + API together
npm run dev
```

Open:

- **App:** http://localhost:5173
- **API:** http://localhost:3001/api/health

Default admin login (change in `.env`):

- Username: `admin`
- Password: `ChangeMe123!`

## How to use

1. **Home** → Start triage
2. Enter a **local patient reference** (stored as hash — never sent in plain text)
3. Complete **Malaria tab**: fever days, endemic area, RDT result, symptoms, danger signs
4. Submit → get WHO-based recommendation
5. If **RDT negative**, **Other diseases** tab unlocks for dengue, typhoid, flu, UTI, pneumonia
6. **Malaria positive** → pharmacist/doctor receives alert (console in dev if SMTP not configured)
7. **Admin** → view anonymized stats and sessions

## Offline behavior

- Service worker caches the app shell and assets
- Triage runs **entirely on-device** (client triage engine)
- Results saved to **IndexedDB** when offline
- Auto-sync to `/api/sync` when connection returns

## Production build

```bash
npm run build
npm start
```

This builds the React app into `client/dist` and serves it from Express on port `3001`.

## Deployment

### Option A — Render / Railway / Fly.io (recommended)

1. Push repo to GitHub
2. Create a **Web Service** pointing to `health-triage/server`
3. **Build command:** `cd .. && npm run install:all && npm run build`
4. **Start command:** `npm start` (from server directory, or set root start script)
5. Set environment variables:

   | Variable | Description |
   |----------|-------------|
   | `PORT` | Platform-assigned (often 8080) |
   | `JWT_SECRET` | Long random string |
   | `ADMIN_USERNAME` | Admin login |
   | `ADMIN_PASSWORD` | Strong password |
   | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | For email alerts |
   | `NOTIFY_EMAIL_DOCTOR` | Doctor inbox |
   | `NOTIFY_EMAIL_PHARMACIST` | Pharmacy inbox |
   | `CORS_ORIGIN` | Your frontend URL if split |

6. Attach a **persistent disk** for `DATABASE_PATH` (SQLite)

### Option B — VPS (Ubuntu)

```bash
# On server
git clone <your-repo> && cd health-triage
npm run install:all
cp server/.env.example server/.env
# Edit .env with secrets and SMTP

npm run build

# Process manager
npm install -g pm2
cd server && pm2 start dist/index.js --name health-triage
pm2 save && pm2 startup
```

Put **Nginx** in front with HTTPS (Let's Encrypt):

```nginx
server {
    listen 443 ssl;
    server_name triage.example.org;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Option C — Docker

```dockerfile
# Dockerfile (place in health-triage/)
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm run install:all && npm run build
ENV PORT=3001
EXPOSE 3001
CMD ["npm", "start"]
```

```bash
docker build -t health-triage .
docker run -p 3001:3001 -v triage-data:/app/server/data --env-file server/.env health-triage
```

### PWA install (field workers)

After deploy, open the site in Chrome/Edge → **Install app**. The triage flow works offline after first load.

## WHO references

- [WHO Malaria Guidelines 2023](https://www.who.int/publications/i/item/guidelines-for-malaria)
- WHO IMCI / iCCM fever and danger signs
- WHO dengue clinical management

> **Disclaimer:** Decision-support tool for hackathon/demo. Not a medical device. Always follow national treatment protocols and qualified clinical judgment.

## Project structure

```
health-triage/
├── client/          # React PWA
│   ├── src/
│   │   ├── i18n/    # Translations (en, tw, fr, es)
│   │   ├── lib/     # Triage engine, API, offline queue
│   │   └── pages/   # Home, Triage, Admin
│   └── vite.config.ts
├── server/          # Express API
│   └── src/
│       ├── triage/  # WHO engine (server-side validation)
│       ├── privacy.ts
│       └── notifications.ts
└── README.md
```

## Environment variables

See `server/.env.example` for full list.

## License

MIT — hackathon use.
