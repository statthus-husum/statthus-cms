import {
  UsernamePasswordAuthJSProvider,
  TinaUserCollection,
} from "tinacms-authjs/dist/tinacms";
import { defineConfig, LocalAuthProvider } from "tinacms";

import { EventCollection } from "./collections/event";
import { NewsCollection } from "./collections/news";
import { PersonCollection } from "./collections/person";
import {
  EventIntroCollection,
  NewsIntroCollection,
  PeopleIntroCollection,
  ThemenFilterCollection,
} from "./collections/themen-intro";

const isLocal = process.env.TINA_PUBLIC_IS_LOCAL === "true";

export default defineConfig({
  authProvider: isLocal
    ? new LocalAuthProvider()
    : new UsernamePasswordAuthJSProvider(),
  contentApiUrlOverride: "/api/tina/gql",

  build: {
    publicFolder: "public",
    outputFolder: "admin",
  },

  // Historie: referenceDepth 1 war hier nötig, solange die (inzwischen
  // entfernten) Projekt-/Mitwohnen-/Unterstützen-Collections über ihr
  // cards-Reference-Feld einen rekursiven Referenz-Graphen bildeten, der
  // den self-hosted Indexer lahmlegte. Aktuell gibt es keine reference-
  // Felder mehr — die Option bleibt als Schutz drin, falls wieder welche
  // dazukommen.
  client: {
    referenceDepth: 1,
  },

  // Custom Media Store: lädt unsere GitHubMediaStore-Klasse, die Bilder
  // direkt nach static/images/ im Hugo-Repo committet (siehe app/tina/
  // media-store.ts und pages/api/media/*).
  media: {
    loadCustomStore: async () => {
      const pack = await import("./media-store");
      return pack.default;
    },
  },

  schema: {
    collections: [
      // Reihenfolge = Sidebar-Reihenfolge. admin-tweaks.js fasst je
      // THEMA zu einem klappbaren Kopf zusammen (News, Veranstaltungen,
      // Bewohner:innen, Weiteres). Jede Gruppe MUSS hier ZUSAMMENHÄNGEND
      // stehen, sonst umschließt ein Header nicht alle Mitglieder am
      // Stück. Themen-Kopftexte bildet allein die Gruppe „Weiteres";
      // nur Users bleibt bewusst ungruppiert (ganz am Ende).
      //
      // Die Seiten unter Projekt/Mitwohnen/Unterstützen werden bewusst
      // NICHT mehr im CMS gepflegt — die variable Seitenstruktur war für
      // Editor:innen zu komplex. Diese Pages entstehen direkt in Hugo
      // (website-Repo, content/german/{projekt,member,help}).
      //
      // News
      NewsCollection,
      NewsIntroCollection,
      // Veranstaltungen
      EventCollection,
      EventIntroCollection,
      // Bewohner:innen
      PersonCollection,
      PeopleIntroCollection,
      // „Weiteres" (nur Themen-Kopftexte)
      ThemenFilterCollection,
      // Ungruppiert (ganz am Ende)
      TinaUserCollection,
    ],
  },
});
