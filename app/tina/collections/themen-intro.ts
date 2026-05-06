import type { Collection } from "tinacms";

// Section-Landing-Pages: alle _index.md Dateien unterhalb content/german/.
// Das umfasst Hugo's Section-Landing-Pages für event, news, people, projekt,
// member, help — und deren Sub-Sections wie projekt/das-denkmal/_index.md —
// sowie die Themen-Filterseiten (themen/wie-wir-leben, themen/wir-im-quartier).
//
// `match.include: "**/_index"` greift jede Tiefe.
//
// `allowedActions: create=false, delete=false` — Sections sind durch die
// Hugo-Verzeichnisstruktur fest vorgegeben. Über die CMS-UI neue
// _index.md anzulegen würde nur eine Datei ohne passendes Verzeichnis-
// Konzept produzieren.
export const ThemenIntroCollection: Collection = {
  name: "section_intro",
  label: "Sektionen",
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
    // Cards verlinken auf Unterseiten der Section. Relevant für /projekt,
    // /member, /help und deren Sub-Sections. Bleibt das Feld leer, rendert
    // das Hugo-Layout einfach keine Cards.
    {
      type: "object",
      name: "cards",
      label: "Cards",
      list: true,
      ui: {
        itemProps: (item: { title?: string }) => ({
          label: item?.title || "(neue Card)",
        }),
      },
      fields: [
        {
          type: "string",
          name: "title",
          label: "Titel",
          required: true,
        },
        {
          type: "string",
          name: "description",
          label: "Beschreibung",
          ui: { component: "textarea" },
        },
        {
          type: "image",
          name: "image",
          label: "Bild",
        },
        {
          type: "string",
          name: "link",
          label: "Ziel",
          description:
            "URL (z.B. /projekt/das-denkmal/ oder https://…) oder Pfad ins Repo (z.B. content/german/projekt/das-denkmal/_index.md) — das Hugo-Layout löst beide Formate auf.",
        },
      ],
    },
    {
      type: "rich-text",
      name: "body",
      label: "Einleitung",
      isBody: true,
    },
  ],
};
