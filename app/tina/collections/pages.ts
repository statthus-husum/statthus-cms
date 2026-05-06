import type { Collection } from "tinacms";

import { cardsField } from "./cards-field";

// Abschnitte unterhalb der Section-Landings /projekt, /member, /help.
//
// Jeder Abschnitt ist genau eine Markdown-Datei direkt im Section-Ordner —
// z.B. content/german/projekt/das-denkmal.md, content/german/help/spenden.md.
// Keine `<slug>/_index.md`-Verzeichnisstruktur, keine verschachtelten
// Unterseiten. Die `_index.md`-Section-Landings selbst sind ausgespart und
// gehören zur section_intro-Collection (themen-intro.ts).
//
// Frontmatter-Konvention orientiert sich an den existierenden Seiten im
// Repo (z.B. about/_index.md, contact.md): title, description, image,
// draft, plus Body. Bewusst schlicht gehalten — Date, Tags, Featured-Slug
// und ähnliches sind News-/Event-spezifisch.

function slugify(title: string | undefined, fallback: string): string {
  const slug = (title || "")
    .toString()
    .toLowerCase()
    .replace(/[äÄ]/g, "ae")
    .replace(/[öÖ]/g, "oe")
    .replace(/[üÜ]/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `${fallback}-${Date.now()}`;
}

function makeSectionCollection(name: string, label: string): Collection {
  return {
    name,
    label,
    path: `content/german/${name}`,
    format: "md",
    // _index.md gehört zur section_intro-Collection — alle anderen
    // Markdown-Dateien direkt hier sind die Abschnitte.
    match: { exclude: "**/_index" },
    ui: {
      filename: {
        slugify: (values) => slugify(values?.title, `neuer-${name}-abschnitt`),
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
        ui: { component: "textarea" },
        description:
          "Erscheint als Teaser, z.B. wenn dieser Abschnitt als Card auf der Section-Landing eingebunden ist.",
      },
      {
        type: "image",
        name: "image",
        label: "Bild",
      },
      {
        type: "boolean",
        name: "draft",
        label: "Entwurf",
        description: "Wenn an, nicht veröffentlicht.",
      },
      cardsField,
      {
        type: "rich-text",
        name: "body",
        label: "Inhalt",
        isBody: true,
      },
    ],
  };
}

export const ProjektCollection = makeSectionCollection(
  "projekt",
  "Projekt-Abschnitte",
);
export const MemberCollection = makeSectionCollection(
  "member",
  "Mitwohnen-Abschnitte",
);
export const HelpCollection = makeSectionCollection(
  "help",
  "Unterstützen-Abschnitte",
);
