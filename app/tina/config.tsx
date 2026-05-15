import {
  UsernamePasswordAuthJSProvider,
  TinaUserCollection,
} from "tinacms-authjs/dist/tinacms";
import { defineConfig, LocalAuthProvider } from "tinacms";

import { EventCollection } from "./collections/event";
import { NewsCollection } from "./collections/news";
import { PersonCollection } from "./collections/person";
import {
  ProjektCollection,
  ProjektSubCollection,
  MemberCollection,
  MemberSubCollection,
  HelpCollection,
  HelpSubCollection,
} from "./collections/pages";
import { ThemenIntroCollection } from "./collections/themen-intro";

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
      TinaUserCollection,
      EventCollection,
      NewsCollection,
      PersonCollection,
      // Kopftexte sollen vor den Abschnitt-Collections in der Sidebar
      // erscheinen — die Reihenfolge in diesem Array bestimmt die
      // Anzeige in Tinas Admin-Menü.
      ThemenIntroCollection,
      ProjektCollection,
      ProjektSubCollection,
      MemberCollection,
      MemberSubCollection,
      HelpCollection,
      HelpSubCollection,
    ],
  },
});
