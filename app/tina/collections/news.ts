import type { Collection } from "tinacms";

const themenOptions = [
  { value: "wie-wir-leben", label: "Wie wir leben" },
  { value: "wir-im-quartier", label: "Wir im Quartier" },
];

const flagsOptions = [
  { value: "top-post", label: "Top-Post (auf der Startseite)" },
];

export const NewsCollection: Collection = {
  name: "news",
  label: "News-Beiträge",
  path: "content/german/news",
  format: "md",
  match: { exclude: "_index" },
  ui: {
    // router auskommentiert — siehe event.ts. Wieder aktivieren mit:
    //   router: ({ document }) => `https://statthus-husum.de/news/${document._sys.filename}/`,
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
        return slug || `neuer-news-eintrag-${Date.now()}`;
      },
    },
  },
  fields: [
    { type: "string", name: "title", label: "Titel", isTitle: true, required: true },
    { type: "datetime", name: "date", label: "Datum", required: true },
    {
      type: "string",
      name: "description",
      label: "Kurzbeschreibung",
      ui: { component: "textarea" },
      required: true,
    },
    {
      type: "image",
      name: "images",
      label: "Bilder",
      list: true,
    },
    {
      type: "string",
      name: "themen",
      label: "Themen-Filter",
      list: true,
      options: themenOptions,
    },
    {
      type: "string",
      name: "flags",
      label: "Markierungen",
      list: true,
      options: flagsOptions,
    },
    { type: "string", name: "tags", label: "Schlagworte", list: true },
    { type: "boolean", name: "draft", label: "Entwurf" },
    { type: "rich-text", name: "body", label: "Inhalt", isBody: true },
  ],
};
