import type { Collection } from "tinacms";

// Chronik (/chronik/ unter „Über uns“): datierte Einträge, die auf der
// Website als Abschnitte im Stil der Projekt-Seite erscheinen — paginiert,
// ohne eigene URL je Eintrag (Hugo-seitig per cascade build.render = never
// in config/_default/hugo.toml). Pflege wie bei News: Titel, Datum,
// Bilder, Text. Template: website layouts/chronik/list.html.

export const ChronikCollection: Collection = {
  name: "chronik",
  label: "Chronik-Einträge",
  path: "content/german/chronik",
  format: "md",
  match: { exclude: "_index" },
  ui: {
    filename: {
      slugify: (values) => {
        const slug = (values?.title || "")
          .toString()
          .toLowerCase()
          .replace(/[äÄ]/g, "ae")
          .replace(/[öÖ]/g, "oe")
          .replace(/[üÜ]/g, "ue")
          .replace(/ß/g, "ss")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        return slug || `neuer-chronik-eintrag-${Date.now()}`;
      },
    },
  },
  fields: [
    { type: "string", name: "title", label: "Titel", isTitle: true, required: true },
    {
      type: "datetime",
      name: "date",
      label: "Datum",
      required: true,
      ui: { dateFormat: "DD.MM.YYYY" },
      description:
        "Bestimmt die Position in der Chronik. Angezeigt wird Monat und Jahr. Ist nur das Jahr bekannt: 1. Januar wählen und unten „Datum als Text“ ausfüllen.",
    },
    {
      type: "string",
      name: "date_label",
      label: "Datum als Text (optional)",
      description:
        'Ersetzt die Anzeige „Monat Jahr“, z.B. „2015“, „Frühjahr 2014“ oder „18. Mai 2026“.',
    },
    {
      type: "image",
      name: "images",
      label: "Bilder",
      list: true,
      description:
        "Optional. Das erste Bild steht groß neben dem Text, weitere erscheinen als Miniaturen darunter.",
    },
    {
      type: "string",
      name: "image_position",
      label: "Bild-Position (optional)",
      options: [
        { value: "right", label: "rechts" },
        { value: "left", label: "links" },
      ],
      description: "Leer lassen: die Seite wechselt automatisch zwischen rechts und links.",
    },
    { type: "boolean", name: "draft", label: "Entwurf", description: "Wenn an, nicht veröffentlicht." },
    { type: "rich-text", name: "body", label: "Inhalt", isBody: true },
  ],
};

// Kopftext der Chronik-Seite (content/german/chronik/_index.md). Eigene
// Collection statt makeSectionIntroCollection, weil hier zusätzlich die
// Sortier-Reihenfolge gepflegt wird — Tina verwirft unbekannte
// Frontmatter-Felder beim Speichern.
export const ChronikIntroCollection: Collection = {
  name: "chronik_intro",
  label: "Chronik-Kopftext",
  path: "content/german/chronik",
  format: "md",
  match: { include: "_index" },
  ui: { allowedActions: { create: false, delete: false } },
  fields: [
    { type: "string", name: "title", label: "Titel", isTitle: true, required: true },
    { type: "string", name: "description", label: "Kurzbeschreibung" },
    {
      type: "string",
      name: "reihenfolge",
      label: "Reihenfolge",
      options: [
        { value: "aufsteigend", label: "Älteste zuerst" },
        { value: "absteigend", label: "Neueste zuerst" },
      ],
    },
    { type: "boolean", name: "draft", label: "Entwurf" },
    { type: "rich-text", name: "body", label: "Einleitung", isBody: true },
  ],
};
