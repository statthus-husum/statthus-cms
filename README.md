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
- `GITHUB_PERSONAL_ACCESS_TOKEN` — Fine-grained PAT nur auf `statthus-website` mit `Contents: Read & Write` und `Actions: Read & Write` (letzteres für den Knopf „Website per FTP neu hochladen“ in der Freigabe-App, der den Deploy-Workflow per workflow_dispatch startet)
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

**Für Inhalte gilt:** MongoDB ist nur Cache-Index, Source-of-Truth ist Git.
Inhalte reindexieren beim Start aus dem GitHub-Repo neu (~30 s).

**Für Editor-Accounts gilt das NICHT.** Die `users`-Collection wird trotz
Pfad `content/users/index.json` **nie nach Git committet** — sie lebt
ausschließlich als Datalayer-App-Data in MongoDB
(`_appDatauser~content/users/index.json`). Folge: ein Mongo-Wipe,
`docker compose down -v` oder ein VM-Neuaufbau **löscht alle Logins**
unwiederbringlich (genau so ist im Mai 2026 der komplette Login-Ausfall
entstanden — siehe `LOGIN-OUTAGE-PROTOKOLL.md`).

Deshalb sichert der **`backup`-Container** (siehe `backup/`, Teil des
docker-compose-Stacks) den User-Store regelmäßig nach Hetzner Object
Storage:

- Bucket + S3-Credentials werden in **statthus-infra** provisioniert
  (`tofu output backup_env_hint` → in `/opt/cms/.env` eintragen, plus
  `S3_ACCESS_KEY`/`S3_SECRET_KEY`).
- Intervall/Retention/Verschlüsselung über `BACKUP_*` in der `.env`.
- Läuft automatisch mit `docker compose up -d` (auch nach VM-Neuaufbau).

**Restore** (Accounts nach Datenverlust zurückholen):

```bash
cd /opt/cms
docker compose stop tina freigabe
docker compose run --rm backup restore.sh        # neuester Dump
#  oder gezielt:  docker compose run --rm backup restore.sh <objektname>
docker compose up -d tina freigabe
# Login in Inkognito testen
```

> ✅ **Verifiziert (2026-05-16):** Accounts **überstehen** `docker compose
> restart` *und* `docker compose up -d --build tina`. Der Entrypoint
> (`rm -rf /app/content` + Re-Clone + `npx tinacms build`) reindexiert nur
> Content; der App-Data-User-Store (`_appDatauser~`) in MongoDB bleibt
> unangetastet. Accounts gehen **nur** verloren, wenn das Mongo-Daten-Volume
> selbst zerstört wird: Mongo-Wipe, `docker compose down -v` oder
> VM-Neuaufbau mit frischem Volume. Genau diesen Fall deckt das Backup ab —
> ein **Restore-on-boot ist daher NICHT nötig** (Backup-only genügt).

Totaler VM-Verlust: neue VM via `tofu apply`, `.env` neu setzen
(inkl. `S3_*`), `docker compose up -d --build`, dann `restore.sh`.

## Lokale Entwicklung

Siehe [`app/README.md`](app/README.md). Kurz: `cd app && npm install && npm run dev` — startet Tina im Local-Mode (kein Auth, Filesystem statt MongoDB).

## Aufbau

| Datei/Ordner | Zweck |
|---|---|
| `app/` | Next.js + TinaCMS-Anwendung (eigenes README) |
| `docker-compose.yml` | Stack-Definition (Caddy + Tina + MongoDB) |
| `Caddyfile` | Reverse-Proxy + Auto-TLS |
| `.env.example` | dokumentierte Env-Variablen |
