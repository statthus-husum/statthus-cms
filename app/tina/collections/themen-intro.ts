import type { Collection } from "tinacms";

// Section-Einleitungen: alle _index.md Dateien unterhalb content/german/.
// Das umfasst Hugo's Section-Landing-Pages für event, news, people, projekt
// und die Themen-Filterseiten (themen/wie-wir-leben, themen/wir-im-quartier).
//
// `match.include: "**/_index"` greift jede Tiefe — flache Sections wie
// event/_index.md und verschachtelte wie themen/wie-wir-leben/_index.md.
//
// `allowedActions: create=false, delete=false` — Sections sind durch die
// Hugo-Verzeichnisstruktur fest vorgegeben. Über die CMS-UI neue
// _index.md anzulegen würde nur eine Datei ohne passendes Verzeichnis-
// Konzept produzieren.
export const ThemenIntroCollection: Collection = {
  name: "section_intro",
  label: "Sektion-Einleitungen",
  path: "content/german",
  format: "md",
  match: { include: "**/_index" },
  ui: {
    allowedActions: {
      create: false,
      delete: false,
    },
  },
  fields: [
    {
      type: "string",
      name: "title",
      label: "Titel",
      isTitle: true,
      required: true,
    },
    {
      type: "string",
      name: "description",
      label: "Kurzbeschreibung",
    },
    {
      type: "string",
      name: "featured",
      label: "Hervorgehobener Post-Slug (optional)",
      description:
        'Nur für "Wir im Quartier" relevant — wenn gesetzt, hebt das Template diesen Post heraus.',
    },
    {
      type: "boolean",
      name: "draft",
      label: "Entwurf",
    },
    {
      type: "rich-text",
      name: "body",
      label: "Einleitung",
      isBody: true,
    },
  ],
};
