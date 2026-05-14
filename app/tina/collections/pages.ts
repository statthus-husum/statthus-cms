import type { Collection } from "tinacms";

import { cardsField } from "./cards-field";

// Abschnitte unterhalb der Section-Landings /projekt, /member, /help.
//
// Diese Collection deckt nur die flachen Top-Level-Dateien direkt im
// Section-Ordner ab — z.B. content/german/projekt/architektur.md,
// content/german/help/spenden.md.
//
// Sub-Folder-Inhalte (z.B. content/german/projekt/das-denkmal/<eintrag>.md)
// sind hier nicht eingeschlossen — rekursives Matching innerhalb dieser
// Collection hatte zu Pfad-Bugs und Sichtbarkeitsausfällen geführt. Für
// Sub-Folder-Editierung später eine separate Collection.
//
// Die `_index.md`-Section-Landings (Top-Level wie auch in Sub-Foldern)
// gehören zur section_intro-Collection (themen-intro.ts). Layout-/Build-
// Defaults pushen wir auf Hugo-Seite via cascade in config/_default/hugo.toml.
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
    // Markdown-Dateien direkt hier sind die Abschnitte. Default-Match
    // ist flach (kein include).
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
        type: "number",
        name: "weight",
        label: "Reihenfolge (Weight)",
        description:
          "Niedrigere Zahlen erscheinen weiter vorn. Hugo sortiert die Abschnitte einer Section anhand dieses Werts.",
      },
      {
        type: "string",
        name: "image_position",
        label: "Bild-Position",
        options: [
          { value: "right", label: "rechts" },
          { value: "left", label: "links" },
        ],
        description:
          "Auf welcher Seite die Card-Abbildung in der Section-Landing steht.",
      },
      {
        type: "boolean",
        name: "draft",
        label: "Entwurf",
        description: "Wenn an, nicht veröffentlicht.",
      },
      // Versteckte Default-Felder: vom Hugo-Theme verlangt (`build.render`
      // schaltet die eigenständige Page ab, der Abschnitt erscheint nur
      // noch als Card auf der Section-Landing). Editor:innen sollen das
      // nicht versehentlich verändern — daher `component: () => null`,
      // Tina behält den Wert beim Speichern aber bei.
      {
        type: "object",
        name: "build",
        label: "Build (versteckt)",
        ui: { component: () => null },
        fields: [
          { type: "string", name: "render" },
          { type: "string", name: "list" },
        ],
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
