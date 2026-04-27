import type { Collection } from "tinacms";

export const PersonCollection: Collection = {
  name: "person",
  label: "Bewohner:innen",
  path: "content/german/people",
  format: "md",
  ui: {
    router: ({ document }) => `/people/${document._sys.filename}/`,
  },
  fields: [
    {
      type: "string",
      name: "title",
      label: "Name",
      isTitle: true,
      required: true,
      description: 'z.B. "Andrea und Martin"',
    },
    { type: "image", name: "image", label: "Foto" },
    { type: "string", name: "einstieg", label: "Einstieg / Wer wir sind", ui: { component: "textarea" } },
    { type: "string", name: "motivation", label: "Motivation", ui: { component: "textarea" } },
    { type: "string", name: "menschliches", label: "Menschliches", ui: { component: "textarea" } },
    { type: "string", name: "funfact", label: "Fun Fact", ui: { component: "textarea" } },
    { type: "string", name: "passion", label: "Leidenschaft", ui: { component: "textarea" } },
    { type: "string", name: "email", label: "E-Mail" },
    {
      type: "object",
      name: "social",
      label: "Social Media",
      list: true,
      ui: {
        itemProps: (item) => ({ label: item?.icon || "Link" }),
      },
      fields: [
        { type: "string", name: "icon", label: 'Icon (z.B. "fab fa-facebook")' },
        { type: "string", name: "link", label: "URL" },
      ],
    },
    { type: "rich-text", name: "body", label: "Weiterer Text", isBody: true },
  ],
};
