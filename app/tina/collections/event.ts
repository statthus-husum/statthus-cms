import type { Collection } from "tinacms";

const themenOptions = [
  { value: "wie-wir-leben", label: "Wie wir leben" },
  { value: "wir-im-quartier", label: "Wir im Quartier" },
];

const flagsOptions = [
  { value: "top-post", label: "Top-Post (auf der Startseite)" },
];

export const EventCollection: Collection = {
  name: "event",
  label: "Veranstaltungen",
  path: "content/german/event",
  format: "md",
  ui: {
    router: ({ document }) => `/event/${document._sys.filename}/`,
    filename: {
      slugify: (values) =>
        (values?.title || "")
          .toString()
          .toLowerCase()
          .replace(/[äÄ]/g, "ae")
          .replace(/[öÖ]/g, "oe")
          .replace(/[üÜ]/g, "ue")
          .replace(/ß/g, "ss")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, ""),
    },
  },
  fields: [
    { type: "string", name: "title", label: "Titel", isTitle: true, required: true },
    { type: "datetime", name: "date", label: "Veröffentlicht am", required: true },
    {
      type: "string",
      name: "description",
      label: "Kurzbeschreibung",
      ui: { component: "textarea" },
      required: true,
      description: "Erscheint als Teaser in News-Listen und Vorschau-Karten.",
    },
    {
      type: "image",
      name: "images",
      label: "Bilder",
      list: true,
      description: "Optional. Erstes Bild wird als Hauptbild verwendet.",
    },
    { type: "datetime", name: "event_date", label: "Beginn", required: true },
    { type: "datetime", name: "event_end", label: "Ende (optional)" },
    { type: "string", name: "event_location", label: "Ort", required: true },
    {
      type: "string",
      name: "themen",
      label: "Themen-Filter",
      list: true,
      options: themenOptions,
      description: "Mehrfachauswahl. Steuert die Filterseiten.",
    },
    {
      type: "string",
      name: "flags",
      label: "Markierungen",
      list: true,
      options: flagsOptions,
    },
    {
      type: "string",
      name: "tags",
      label: "Schlagworte",
      list: true,
    },
    { type: "boolean", name: "draft", label: "Entwurf", description: "Wenn an, nicht veröffentlicht." },
    { type: "rich-text", name: "body", label: "Inhalt", isBody: true },
  ],
};
