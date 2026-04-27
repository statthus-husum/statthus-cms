# Tina CMS App (staTThus)

Next.js + TinaCMS Self-Hosted Backend. Committet Inhalts-Änderungen direkt ins [statthus-website](https://github.com/statthus-husum/statthus-website)-Repo.

## Architektur

| Komponente | Rolle |
|---|---|
| **Next.js / Tina** | Admin-UI (`/admin/`) + GraphQL-API (`/api/tina/gql`) |
| **MongoDB** | Datalayer-Cache-Index (Source of Truth bleibt Git) |
| **Auth.js (Credentials)** | Email/Passwort-Login, User in `content/users/index.json` |
| **GitHub Provider** | Schreibt Markdown-Änderungen ins `statthus-website`-Repo |

## Lokale Entwicklung

```bash
cp .env.example .env
$EDITOR .env       # nur GITHUB_*, NEXTAUTH_SECRET fürs prod-Mode-Testen
npm install
npm run dev        # TINA_PUBLIC_IS_LOCAL=true → kein Auth, lokales Filesystem
```

`http://localhost:3000/admin/` öffnen.

Lokaler Mode:
- Kein Login nötig (LocalAuthProvider)
- Inhalte werden im Filesystem editiert (relativ zu Repo-Root, NICHT direkt in Hugo-Repo!)
- Du müsstest die Hugo-Inhalte ins `content/`-Verzeichnis dieser App symlinken oder kopieren — für Schemata-Iteration reicht aber, was im Demo-Stand drin ist

## Production-Mode lokal testen

```bash
npm run dev:prod
```

Dafür müssen alle `.env`-Variablen gesetzt sein. MongoDB läuft idealerweise schon (z.B. via `docker run -p 27017:27017 mongo:7`).

## Schema

Definiert in `tina/config.tsx` und `tina/collections/`:

| Collection | Hugo-Pfad | Inhalt |
|---|---|---|
| `event` | `content/german/event/` | Termine mit Beginn/Ende/Ort |
| `news` | `content/german/news/` | News ohne Termin |
| `person` | `content/german/people/` | Bewohner:innen-Steckbriefe |
| `TinaUserCollection` | `content/users/` | Editor-Accounts (auto-managed) |

`themen-intros` (Filter-Seiten) ist noch nicht als Tina-Collection erfasst — die zwei `_index.md`-Dateien bleiben vorerst per Hand zu pflegen.

## Erste:n Editor:in einrichten

Default-Credentials nach erstem Deploy:
- Username: `admin`
- Email: `admin@statthus-husum.de`
- Passwort: `statthus-init-2026`
- `passwordChangeRequired: true` → muss beim ersten Login geändert werden

⚠️ Initial-Passwort vor dem ersten Login ändern (Repo-Edit) oder direkt nach Login. Es ist im Klartext im Repo.

## Deployment

Wird per Docker Compose vom Eltern-Repo orchestriert. Siehe [statthus-cms/README.md](../README.md).

## Bekannte Themen / TODO

- [ ] `themen-intros` als File-Collection ergänzen
- [ ] Bilder-Upload-Pfad: aktuell `static-images/` unter Hugo-Repo. Prüfen, ob Hugo die korrekt unter `/static-images/...` ausliefert oder ob wir auf `static/images/` umstellen
- [ ] Visual-Edit-Mode an Hugo-Site anbinden (Stretch-Goal — separater Iframe mit Hugo-Dev-Server)
- [ ] CI: Lint + Type-Check on PR
