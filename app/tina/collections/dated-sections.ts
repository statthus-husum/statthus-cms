import type { Collection } from "tinacms";

// Datierte Abschnitts-Seiten: Chronik (/chronik/) und Presse und Medien
// (/presse/) unter „Über uns“, dazu das Newsletter-Archiv (/newsletter/,
// kompakte Liste ohne Bilder und ohne Kopftext-Collection — das
// _index.md dort ist rohes Brevo-Formular-HTML, das Tinas Rich-Text-Editor
// zerstören würde). Einträge erscheinen auf der Website als
// Abschnitte im Stil der Projekt-Seite — paginiert, ohne eigene URL je
// Eintrag (Hugo-seitig per cascade build.render = never in
// config/_default/hugo.toml). Pflege wie bei News: Titel, Datum, Bilder,
// Text. Template: website layouts/partials/dated-sections.html.
//
// Pro Section zwei Collections am selben Pfad mit disjunktem match:
//   <name>        — die Einträge (exclude "_index")
//   <name>_intro  — Kopftext + Reihenfolge (include "_index"). Eigene
//                   Collection statt makeSectionIntroCollection, weil Tina
//                   unbekannte Frontmatter-Felder beim Speichern verwirft
//                   und hier `reihenfolge` dazukommt.

type Field = NonNullable<Collection["fields"]>[number];

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

function makeDatedSection(opts: {
  name: string;
  label: string;
  introLabel: string;
  dateDescription: string;
  // Zusätzliche Felder, direkt nach dem Datum eingefügt (z.B. Presse:
  // Quelle + Link).
  extraFields?: Field[];
  // false: keine Bild-Felder (Newsletter-Archiv ist eine reine Textliste).
  images?: boolean;
  bodyLabel?: string;
}): { entries: Collection; intro: Collection } {
  const imageFields: Field[] =
    opts.images === false
      ? []
      : [
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
            description:
              "Leer lassen: die Seite wechselt automatisch zwischen rechts und links.",
          },
        ];

  const entries: Collection = {
    name: opts.name,
    label: opts.label,
    path: `content/german/${opts.name}`,
    format: "md",
    match: { exclude: "_index" },
    ui: {
      filename: {
        slugify: (values) => slugify(values?.title, `neuer-${opts.name}-eintrag`),
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
        description: opts.dateDescription,
      },
      {
        type: "string",
        name: "date_label",
        label: "Datum als Text (optional)",
        description:
          'Ersetzt die Datums-Anzeige, z.B. „2015“, „Frühjahr 2014“ oder „18. Mai 2026“.',
      },
      ...(opts.extraFields || []),
      ...imageFields,
      { type: "boolean", name: "draft", label: "Entwurf", description: "Wenn an, nicht veröffentlicht." },
      { type: "rich-text", name: "body", label: opts.bodyLabel || "Inhalt", isBody: true },
    ],
  };

  const intro: Collection = {
    name: `${opts.name}_intro`,
    label: opts.introLabel,
    path: `content/german/${opts.name}`,
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

  return { entries, intro };
}

const chronik = makeDatedSection({
  name: "chronik",
  label: "Chronik-Einträge",
  introLabel: "Chronik-Kopftext",
  dateDescription:
    "Bestimmt die Position in der Chronik. Angezeigt wird Monat und Jahr. Ist nur das Jahr bekannt: 1. Januar wählen und unten „Datum als Text“ ausfüllen.",
});
export const ChronikCollection = chronik.entries;
export const ChronikIntroCollection = chronik.intro;

const presse = makeDatedSection({
  name: "presse",
  label: "Presse-Einträge",
  introLabel: "Presse-Kopftext",
  dateDescription:
    "Erscheinungsdatum des Beitrags. Bestimmt die Reihenfolge; angezeigt wird das volle Datum.",
  extraFields: [
    // Werte müssen zur $typen-Tabelle im Website-Partial
    // layouts/partials/dated-sections.html passen (Symbol + Bezeichnung).
    {
      type: "string",
      name: "typ",
      label: "Art des Beitrags",
      options: [
        { value: "zeitung", label: "Zeitung / Print" },
        { value: "tv", label: "TV" },
        { value: "radio", label: "Radio" },
        { value: "web", label: "Online / Web" },
        { value: "podcast", label: "Podcast" },
        { value: "sonstiges", label: "Sonstiges" },
      ],
      description: "Erscheint als kleine Marke mit Symbol über dem Titel.",
    },
    {
      type: "string",
      name: "quelle",
      label: "Medium / Quelle",
      description: 'z.B. „Husumer Nachrichten“ oder „NDR 1 Welle Nord“. Steht vor dem Datum.',
    },
    {
      type: "string",
      name: "link",
      label: "Link zum Beitrag",
      description:
        "Vollständige Adresse mit https://… Erscheint als Knopf unter dem Text und öffnet in einem neuen Tab.",
    },
    {
      type: "string",
      name: "link_text",
      label: "Knopf-Beschriftung (optional)",
      description: 'Standard: „Zum Beitrag“. Z.B. „Zum Video“ oder „Artikel als PDF“.',
    },
  ],
});
export const PresseCollection = presse.entries;
export const PresseIntroCollection = presse.intro;

// Newsletter-Archiv: nur die Ausgaben. KEINE Kopftext-Collection — siehe
// Dateikopf (newsletter/_index.md = Brevo-Formular, nur per Git pflegen).
const newsletter = makeDatedSection({
  name: "newsletter",
  label: "Newsletter-Ausgaben",
  introLabel: "(nicht registriert)",
  images: false,
  bodyLabel: "Volltext (optional)",
  dateDescription: "Versanddatum der Ausgabe. Neueste Ausgaben stehen im Archiv oben.",
  extraFields: [
    {
      type: "string",
      name: "description",
      label: "Kurztext",
      ui: { component: "textarea" },
      description: "Ein bis zwei Sätze: Was steht in dieser Ausgabe?",
    },
    {
      type: "string",
      name: "link",
      label: "Link zur Ausgabe (optional)",
      description:
        "Webversion („Im Browser ansehen“) mit https://… oder ein PDF auf der Website, z.B. /dokumente/newsletter/2025-03.pdf. Ohne Link: Volltext unten einfügen, er klappt dann im Archiv auf.",
    },
    {
      type: "string",
      name: "link_text",
      label: "Knopf-Beschriftung (optional)",
      description: 'Standard: „Ausgabe ansehen“. Z.B. „Als PDF“.',
    },
  ],
});
export const NewsletterCollection = newsletter.entries;
