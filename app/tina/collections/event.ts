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
  match: { exclude: "_index" },
  ui: {
    // router auskommentiert: würde Tina dazu bringen, /event/<slug>/ zu öffnen,
    // aber das ist eine Hugo-URL, nicht der CMS-Server. Wieder aktivieren mit
    // absoluter URL, sobald die Hugo-Site auf https://statthus-husum.de live ist:
    //   router: ({ document }) => `https://statthus-husum.de/event/${document._sys.filename}/`,
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
        // Fallback wenn Titel noch leer — sonst entsteht ein leerer Dateiname
        // ".md" und Tina kann den keiner Collection zuordnen.
        return slug || `neue-veranstaltung-${Date.now()}`;
      },
    },
  },
  fields: [
    { type: "string", name: "title", label: "Titel", isTitle: true, required: true },
    {
      type: "datetime",
      name: "date",
      label: "Veröffentlicht am",
      required: true,
      ui: { dateFormat: "DD.MM.YYYY" },
      description:
        "Steuert die Reihenfolge im News-Feed. Der Termin selbst steht unten unter „Beginn“.",
    },
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
    // Ohne ui.timeFormat zeigt Tina nur einen Datums-Picker — die Uhrzeit
    // ließ sich dann gar nicht eingeben. Tina speichert Datum+Zeit als UTC
    // (…Z); die Hugo-Templates rechnen über partials/functions/event-time
    // nach Europe/Berlin um.
    {
      type: "datetime",
      name: "event_date",
      label: "Beginn (Datum und Uhrzeit)",
      required: true,
      ui: { dateFormat: "DD.MM.YYYY", timeFormat: "HH:mm" },
    },
    {
      type: "datetime",
      name: "event_end",
      label: "Ende (optional)",
      ui: { dateFormat: "DD.MM.YYYY", timeFormat: "HH:mm" },
    },
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
