import type { Collection } from "tinacms";

// Themen-Intros sind die zwei _index.md-Dateien der Filterseiten:
//   content/german/themen/wie-wir-leben/_index.md
//   content/german/themen/wir-im-quartier/_index.md
//
// Hugo erwartet die Subdir/_index.md-Struktur. Tina's `match`-Pattern lässt uns
// die zwei spezifischen Dateien als gemeinsame Collection adressieren.
//
// `allowedActions: create=false, delete=false` — Editoren dürfen nur die
// existierenden zwei pflegen, keine neuen Themen erfinden (sonst landen sie
// in der Hugo-Taxonomie aber haben keinen Filter-Backlink).
export const ThemenIntroCollection: Collection = {
  name: "themen_intro",
  label: "Themen-Intros",
  path: "content/german/themen",
  format: "md",
  match: {
    include: "*/_index",
  },
  ui: {
    allowedActions: {
      create: false,
      delete: false,
    },
    router: ({ document }) =>
      `/themen/${document._sys.breadcrumbs[0]}/`,
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
      required: true,
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
