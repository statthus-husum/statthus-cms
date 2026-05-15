import type { Collection } from "tinacms";

import { cardsField } from "./cards-field";

// Abschnitte unterhalb der Section-Landings /projekt, /member, /help.
//
// Zwei Collections pro Section:
//
//   <name>        "…-Abschnitte"     — flache Top-Level-Dateien direkt im
//                                      Section-Ordner, z.B.
//                                      content/german/projekt/architektur.md
//
//   <name>_sub    "…-Unterseiten"    — Dateien EINE Ebene tiefer, in
//                                      Sub-Section-Ordnern, z.B.
//                                      content/german/projekt/das-denkmal/
//                                        architekturgeschichtliche-bedeutung.md
//
// Bewusst zwei getrennte Collections statt rekursivem Matching in einer:
// ein "**/*"-Include hatte die flachen Einträge verschwinden lassen und
// über die Pfad-Überlappung mit section_intro (Kopftexte) malformte
// GetDocument-Pfade erzeugt ("content/german/das-denkmal/_index.md" ohne
// /projekt/). Klare, nicht-überlappende Match-Patterns vermeiden das.
//
// _index.md-Zuordnung:
//   - Top-Level-Landings (projekt/_index, news/_index, …) und die
//     Themen-Filterseiten → section_intro (themen-intro.ts)
//   - Sub-Section-Landings (projekt/das-denkmal/_index, …) → die
//     "<name>_sub"-Collection hier (volles Feld-Set, editierbar)
// Die Match-Patterns sind disjunkt, kein File gehört zwei Collections.
// Layout-/Build-Defaults pushen wir Hugo-seitig via cascade in
// config/_default/hugo.toml.
//
// Frontmatter-Konvention: title, description, image, weight,
// image_position, draft, build (versteckt), cards, body.

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

// Gemeinsames Feld-Set für flache Abschnitte und Sub-Unterseiten.
const sectionFields: NonNullable<Collection["fields"]> = [
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
];

// Flache Abschnitte: nur Dateien direkt im Section-Ordner.
function makeSectionCollection(name: string, label: string): Collection {
  return {
    name,
    label,
    path: `content/german/${name}`,
    format: "md",
    // include "*" = NUR genau eine Pfad-Ebene (Dateien direkt im
    // Section-Ordner). Ohne include rekursiert Tina und zeigt auch
    // Sub-Folder-Inhalte — die gehören aber in die *_sub-Collection.
    // exclude "_index": projekt/_index.md → section_intro.
    match: { include: "*", exclude: "_index" },
    ui: {
      filename: {
        slugify: (values) => slugify(values?.title, `neuer-${name}-abschnitt`),
      },
    },
    fields: sectionFields,
  };
}

// Sub-Unterseiten: alle Dateien genau eine Ebene tief (Sub-Section-
// Ordner), inklusive der Sub-Section-Landing `<sub>/_index.md`.
//
// Kein exclude auf "*/_index": section_intro matched seit der
// {*,themen/*}/_index-Einschränkung die Sub-Section-Landings nicht
// mehr, also gibt es hier keine Pfad-Überlappung — und die
// Sub-Section-Landing wird genau hier mit vollem Feld-Set editierbar.
function makeSubSectionCollection(name: string, label: string): Collection {
  return {
    name: `${name}_sub`,
    label,
    path: `content/german/${name}`,
    format: "md",
    match: { include: "*/*" },
    ui: {
      // Slug bleibt flach; in welchen Sub-Ordner die Datei kommt,
      // bestimmt der Datei-Browser bzw. der bestehende Sub-Folder.
      filename: {
        slugify: (values) => slugify(values?.title, `neuer-${name}-eintrag`),
      },
    },
    fields: sectionFields,
  };
}

export const ProjektCollection = makeSectionCollection(
  "projekt",
  "Projekt-Abschnitte",
);
export const ProjektSubCollection = makeSubSectionCollection(
  "projekt",
  "Projekt-Unterseiten",
);
export const MemberCollection = makeSectionCollection(
  "member",
  "Mitwohnen-Abschnitte",
);
export const MemberSubCollection = makeSubSectionCollection(
  "member",
  "Mitwohnen-Unterseiten",
);
export const HelpCollection = makeSectionCollection(
  "help",
  "Unterstützen-Abschnitte",
);
export const HelpSubCollection = makeSubSectionCollection(
  "help",
  "Unterstützen-Unterseiten",
);
