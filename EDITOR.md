# staTThus-CMS · Spickzettel für Editor:innen

Willkommen — du kannst hier Beiträge für die staTThus-Website schreiben. Diese Anleitung erklärt das Wichtigste auf zwei Seiten.

---

## 1. Einloggen

Im Browser öffnen: **https://schreibe.statthus-husum.de/admin/index.html**

- **Username:** dein Benutzername (vom Admin bekommen)
- **Password:** dein Initial-Passwort (vom Admin bekommen)

Beim ersten Login wirst du aufgefordert, ein eigenes Passwort zu setzen. Tu das gleich.

---

## 2. Was du siehst

**Linke Seitenleiste** = die Inhaltstypen, die du bearbeiten kannst:

| Eintrag | Was es ist |
|---|---|
| **Veranstaltungen** | Termine mit Datum + Ort (Stammtisch, Workshop, Sommerfest …) |
| **News-Beiträge** | Nachrichten ohne festen Termin (Baufortschritt, neue Förderung …) |
| **Bewohner:innen** | Steckbriefe von Personen, die im staTThus wohnen |
| **Themen-Intros** | Die Einleitungstexte für „Wie wir leben" und „Wir im Quartier" |
| **Users** | Editor-Accounts (nur für Admins relevant) |

---

## 3. Englisch-Glossar — die wichtigsten UI-Wörter

Das Tina-Tool selbst ist auf Englisch. Was du regelmäßig siehst:

| Englisch | Deutsch |
|---|---|
| **Save** | Speichern |
| **Save Draft** | Als Entwurf speichern |
| **Publish** | Veröffentlichen |
| **Cancel** | Abbrechen |
| **Create New** | Neu anlegen |
| **Delete** | Löschen |
| **Are you sure?** | Bist du sicher? |
| **Document List** | Übersicht aller Beiträge |
| **Settings** | Einstellungen |
| **Loading…** | Lädt … |
| **Sign Out** | Abmelden |
| **Required** | Pflichtfeld |
| **Optional** | Optional |

---

## 4. Einen neuen Beitrag schreiben — Schritt für Schritt

**Beispiel: News-Beitrag „Neue Sitzbank im Garten"**

1. Linke Seitenleiste → **News-Beiträge** anklicken
2. Oben rechts auf **Create New** klicken
3. Felder ausfüllen:
   - **Titel:** „Neue Sitzbank im Garten"
   - **Datum:** heute (das Veröffentlichungsdatum)
   - **Kurzbeschreibung:** ein bis zwei Sätze für die Vorschau-Karte
   - **Bilder:** optional (siehe Punkt 5)
   - **Themen-Filter:** wenn passend, „Wie wir leben" oder „Wir im Quartier" wählen
   - **Schlagworte:** frei (z.B. „garten, gemeinschaft")
   - **Inhalt:** der eigentliche Text — Markdown-Editor mit Formatierungs-Buttons
4. **Save Draft** unten rechts — der Beitrag liegt erstmal als Entwurf
5. Wenn du fertig bist: **Entwurf**-Schalter ausschalten und **Save** klicken — dann ist er live (binnen 1–2 Minuten auf der Website)

Der gleiche Ablauf gilt für Veranstaltungen (mit zusätzlich Datum/Uhrzeit/Ort) und Bewohner:innen-Profile.

---

## 5. Bilder hochladen

Im Bearbeitungs-Formular bei einem Bild-Feld:

1. Auf das **+** oder **Browse Media** klicken
2. **Upload** — eine oder mehrere Bilddateien vom Rechner wählen
3. Hochgeladenes Bild auswählen → **Insert**

Das Bild liegt danach im Repo unter `static-images/` und wird beim nächsten Website-Build automatisch ausgeliefert.

**Bilder-Tipps:**
- Quer-Format funktioniert für News am besten (16:9 oder 4:3)
- Max. 1920px Breite reicht — größere Bilder kosten nur Ladezeit
- Sprechende Dateinamen helfen (`sommerfest-2026-tanzen.jpg` statt `IMG_2847.jpg`)

---

## 6. Existierenden Beitrag bearbeiten

1. Collection in Seitenleiste (z.B. **News-Beiträge**)
2. Den Beitrag in der Liste anklicken
3. Felder ändern
4. **Save** rechts unten

Tipp: kleine Änderungen direkt auf „Save", **kein** Entwurf-Umweg nötig — der Beitrag bleibt veröffentlicht und die Änderung geht binnen 1–2 Minuten live.

---

## 7. Beitrag löschen

1. Beitrag öffnen
2. Oben rechts (oder unter Settings) auf das **Mülleimer-Icon** / **Delete**
3. Bestätigen

⚠️ Lieber **Entwurf**-Schalter aktivieren statt löschen — dann kann der Beitrag später wieder reaktiviert werden.

---

## 8. Was tun wenn …

**„Failed loading TinaCMS assets"**
→ Browser hart-refreshen: **Strg + F5** (Windows/Linux) oder **Cmd + Shift + R** (Mac).

**Login klappt nicht**
→ Großschreibung in Username prüfen. Falls weiter klemmt: an Admin wenden, Passwort kann zurückgesetzt werden.

**Mein Beitrag erscheint nicht auf der Website**
→ Erst 2 Minuten warten (Build-Zeit). Falls dann immer noch nicht: ist der **Entwurf**-Schalter vielleicht noch an? Dann ist der Beitrag absichtlich versteckt.

**Ich habe das falsche Bild hochgeladen**
→ Im Bild-Feld auf das alte Bild klicken → **Replace** oder **Remove** → neues Bild auswählen.

**Ich habe was kaputt gemacht / falsch gespeichert**
→ Kein Stress, alle Änderungen sind in Git versioniert. Admin kann jeden früheren Stand wiederherstellen.

---

## 9. Hilfe / Kontakt

- **Direkter Admin:** Martin (martin.jahr@statthus-husum.de)
- **Bug oder Feature-Wunsch:** als Issue im [statthus-cms Repo](https://github.com/statthus-husum/statthus-cms/issues) eintragen oder einfach Martin sagen

Viel Spaß beim Schreiben!
