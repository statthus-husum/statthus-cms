import type { Collection } from "tinacms";

// Reguläre Inhaltsseiten unterhalb von /projekt, /member, /help.
//
// Ausgenommen sind die Section-Landing-Pages (`_index.md`) — die werden
// von der Section-Collection (themen-intro.ts) bedient. Hier landen also
// nur die Cards-Ziele wie /projekt/das-denkmal/, /help/spenden/, etc.,
// und die in den Sektionen frei anlegbaren Unterseiten.
//
// Frontmatter-Konvention orientiert sich an den existierenden Seiten im
// Repo (z.B. about/_index.md, contact.md): title, description, image,
// draft, plus Body. Bewusst schlicht gehalten — Date, Tags, Featured-
// Slug und ähnliches sind News-/Event-spezifisch und gehören nicht in
// generische Inhaltsseiten.

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

function makePageCollection(name: string, label: string): Collection {
  return {
    name,
    label,
    path: `content/german/${name}`,
    format: "md",
    // _index.md ist Section-Landing — gehört zur section_intro-Collection,
    // nicht hierher. Alle anderen Markdown-Dateien (auch verschachtelte
    // Unterseiten) sind hier zu Hause.
    match: { exclude: "**/_index" },
    ui: {
      filename: {
        slugify: (values) => slugify(values?.title, `neue-${name}-seite`),
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
          "Erscheint als Teaser, z.B. wenn diese Seite als Card auf einer Section-Landing eingebunden ist.",
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
      {
        type: "rich-text",
        name: "body",
        label: "Inhalt",
        isBody: true,
      },
    ],
  };
}

export const ProjektCollection = makePageCollection("projekt", "Projekt-Seiten");
export const MemberCollection = makePageCollection("member", "Mitwohnen-Seiten");
export const HelpCollection = makePageCollection("help", "Unterstützen-Seiten");
