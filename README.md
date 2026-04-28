# statthus-cms

Selbst-gehostetes Tina CMS für die staTThus-Website. Editoren melden sich mit Email/Passwort an, Inhalts-Änderungen werden direkt ins [statthus-website](https://github.com/statthus-husum/statthus-website)-Repo committet.

## Architektur

```
        Bewohner:in
            │
            ▼
   schreibe.statthus-husum.de
            │
       ┌────┴────┐
       │  Caddy  │  Auto-TLS via Let's Encrypt, Reverse Proxy
       └────┬────┘
            │ tina:3000
   ┌────────┴────────┐
   │  Tina Backend   │  Next.js, Auth.js (Email/PW), GraphQL-API
   │   + Admin UI    │
   └─┬────────────┬──┘
     │            │
     │            ▼
     │      ┌──────────┐
     │      │ MongoDB  │  Datalayer-Index (Cache; SoT bleibt Git)
     │      └──────────┘
     │
     ▼ commits via GitHub API
   github.com/statthus-husum/statthus-website
            │
            ▼ GitHub Action
   statthus-husum.de  (über GitHub Pages mit Custom Domain)
```

## Erst-Deployment (manuell, einmalig)

Server existiert bereits via [statthus-infra](https://github.com/statthus-husum/statthus-infra). Cloud-init hat das CMS-Repo nach `/opt/cms` geklont und Caddy mit Platzhalter gestartet (Phase 1).

Für Phase 2 (Tina + MongoDB) auf dem Server:

```bash
ssh root@<server-ip>
cd /opt/cms
git pull               # holt diesen Stand

# .env anlegen — auf der VM mit den richtigen Werten:
cp .env.example .env
$EDITOR .env
```

In der `.env` zwingend zu setzen:
- `GITHUB_PERSONAL_ACCESS_TOKEN` — Fine-grained PAT mit `Contents: Read & Write` nur auf `statthus-website`
- `NEXTAUTH_SECRET` — `openssl rand -base64 32`
- `MONGO_PASS` — beliebiges starkes Passwort (wird beim ersten Mongo-Start gesetzt)
- `FREIGABE_PASS` — Passwort für die Approval-App unter `/freigabe/`
- `GITHUB_BRANCH=staging` (Editorial Workflow) oder `main` (Direktveröffentlichung)

Dann Stack hochziehen:

```bash
docker compose up -d --build
docker compose logs -f tina    # Build dauert beim ersten Mal ~3-5 min
```

Nach dem Build: ein einmaliger Indexierungs-Lauf, damit die existierenden
Hugo-Inhalte in MongoDB landen (sonst sieht der Editor leere Listen):

```bash
docker compose exec tina npx tinacms build
```

Anschließend `https://schreibe.statthus-husum.de/admin/index.html` öffnen → Login mit:
- Username: `admin`
- Passwort: `statthus-init-2026`

⚠️ Beim ersten Login wirst du zum Passwort-Wechsel aufgefordert. Tu das.

## Editorial Workflow (`staging` → `main`)

Tina ist konfiguriert, in den `staging`-Branch des Hugo-Repos zu committen.
Dort sammeln sich Bewohner:innen-Edits, bis sie freigegeben werden.

**Freigabe-App:** [`https://schreibe.statthus-husum.de/freigabe/`](https://schreibe.statthus-husum.de/freigabe/)

- Login: `FREIGABE_USER` / `FREIGABE_PASS` aus `.env` (HTTP Basic Auth)
- Zeigt offene Commits + geänderte Dateien (`staging` vs `main`)
- „Alle Änderungen freigeben" → Merge per GitHub-API → Hugo-Build → live
- Falls Konflikte: Diff in GitHub anschauen, manuell mergen (Notfall-Pfad)

Direktes Deployment ohne Review: `GITHUB_BRANCH=main` in `.env`, Container neu
starten — Tina committet dann direkt auf `main`.

## Schema / Collections

Definiert in [`app/tina/config.tsx`](app/tina/config.tsx) und [`app/tina/collections/`](app/tina/collections/):

| Collection | Hugo-Pfad | Inhalt |
|---|---|---|
| `event` | `content/german/event/` | Termine mit `event_date`/`event_end`/`event_location` |
| `news` | `content/german/news/` | Nachrichten ohne Termin |
| `person` | `content/german/people/` | Bewohner:innen-Steckbriefe |
| `themen_intro` | `content/german/themen/<term>/_index.md` | Einleitungstexte der Filterseiten (nur Edit, kein Create/Delete) |
| `users` (intern) | `content/users/index.json` | Editor-Accounts |

## Updates ausrollen

| Was hat sich geändert? | Befehl |
|---|---|
| Nur Inhalt (über Tina-UI editiert) | nichts — Tina committet direkt |
| Schema in `app/tina/` (Collection-Felder, neue Collection, …) | `cd /opt/cms && git pull && docker compose up -d --build tina` |
| Manuelles Re-Indexing nötig | `docker compose exec tina npx tinacms build && docker compose restart tina` (**Restart ist Pflicht** — Next.js cached `public/` zum Start) |
| Caddy-Config | `git pull && docker compose restart caddy` |
| Komplett-Neustart | `docker compose down && docker compose up -d` |

## Backup

MongoDB enthält nur den Cache-Index — Source-of-Truth ist Git. Bei einem totalen Verlust:
1. neue VM via `tofu apply` aufbauen
2. `.env` neu setzen
3. `docker compose up -d --build`
4. Tina indexiert beim ersten Start aus dem GitHub-Repo neu (~30 s)

Optional zusätzliche Backups: `mongodump` als nächtlicher Cron-Job, Output auf Hetzner Object Storage (S3-kompatibel).

## Lokale Entwicklung

Siehe [`app/README.md`](app/README.md). Kurz: `cd app && npm install && npm run dev` — startet Tina im Local-Mode (kein Auth, Filesystem statt MongoDB).

## Aufbau

| Datei/Ordner | Zweck |
|---|---|
| `app/` | Next.js + TinaCMS-Anwendung (eigenes README) |
| `docker-compose.yml` | Stack-Definition (Caddy + Tina + MongoDB) |
| `Caddyfile` | Reverse-Proxy + Auto-TLS |
| `.env.example` | dokumentierte Env-Variablen |
