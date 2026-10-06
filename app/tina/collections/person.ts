import type { Collection, Template } from "tinacms";

// Zwei Profil-Vorlagen in EINER Collection: Erwachsene und Kinder bekommen
// unterschiedliche Fragen, liegen aber im selben Ordner und erscheinen
// gemeinsam auf /people/. Tina schreibt die gewählte Vorlage als
// `_template: erwachsen | kind` ins Frontmatter; das Hugo-Layout
// (layouts/people/single.html) verzweigt darauf. Jede Datei MUSS ein
// `_template` haben — sonst kann Tina sie nicht öffnen.
// Die Vorlage wird beim Anlegen gewählt und lässt sich im CMS nicht
// nachträglich wechseln (dann im Git-Frontmatter ändern).

const textarea = (name: string, label: string, description?: string) => ({
  type: "string" as const,
  name,
  label,
  description,
  ui: { component: "textarea" },
});

const nameField = {
  type: "string" as const,
  name: "title",
  label: "Name",
  isTitle: true,
  required: true,
  description: 'z.B. "Andrea und Martin"',
};

const imageField = { type: "image" as const, name: "image", label: "Foto" };

const socialField = {
  type: "object" as const,
  name: "social",
  label: "Social Media",
  list: true,
  ui: {
    itemProps: (item: { icon?: string }) => ({ label: item?.icon || "Link" }),
  },
  fields: [
    { type: "string" as const, name: "icon", label: 'Icon (z.B. "fab fa-facebook")' },
    { type: "string" as const, name: "link", label: "URL" },
  ],
};

const bodyField = {
  type: "rich-text" as const,
  name: "body",
  label: "Weiterer Text",
  isBody: true,
};

const ErwachsenTemplate: Template = {
  name: "erwachsen",
  label: "Erwachsene:r",
  fields: [
    nameField,
    imageField,
    textarea("einstieg", "Einstieg / Wer wir sind"),
    textarea("motivation", "Motivation"),
    textarea("menschliches", "Menschliches"),
    textarea("funfact", "Fun Fact"),
    textarea("passion", "Leidenschaft"),
    { type: "string", name: "email", label: "E-Mail" },
    socialField,
    bodyField,
  ],
};

const KindTemplate: Template = {
  name: "kind",
  label: "Kind",
  fields: [
    { ...nameField, description: 'Nur Vorname, z.B. "Mia"' },
    { ...imageField, label: "Bild" },
    textarea("dasbinich", "Das bin ich"),
    textarea("lieblingsplatz", "Mein Lieblingsplatz im staTThus"),
    textarea("spass", "Das macht mir hier Spaß"),
    textarea("superkraft", "Wenn das staTThus eine Superkraft hätte, …"),
    textarea("geheimnis", "Das wissen die meisten Leute nicht über mich"),
    textarea("wunsch", "Mein Wunsch für das staTThus"),
    textarea(
      "neueskind",
      "Was würdest du einem neuen Kind erzählen, das hier einziehen möchte?",
      "Nur für ältere Kinder. Bei jüngeren Kindern leer lassen — die Frage erscheint auf der Website nur, wenn sie beantwortet ist.",
    ),
    bodyField,
  ],
};

export const PersonCollection: Collection = {
  name: "person",
  label: "Bewohner:innen",
  path: "content/german/people",
  format: "md",
  match: { exclude: "_index" },
  ui: {
    // router auskommentiert — siehe event.ts. Wieder aktivieren mit:
    //   router: ({ document }) => `https://statthus-husum.de/people/${document._sys.filename}/`,
  },
  templates: [ErwachsenTemplate, KindTemplate],
};
