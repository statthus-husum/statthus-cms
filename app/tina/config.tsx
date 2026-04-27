import {
  UsernamePasswordAuthJSProvider,
  TinaUserCollection,
} from "tinacms-authjs/dist/tinacms";
import { defineConfig, LocalAuthProvider } from "tinacms";

import { EventCollection } from "./collections/event";
import { NewsCollection } from "./collections/news";
import { PersonCollection } from "./collections/person";
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

  media: {
    tina: {
      mediaRoot: "static-images",
      publicFolder: "content/german",
    },
  },

  schema: {
    collections: [
      TinaUserCollection,
      EventCollection,
      NewsCollection,
      PersonCollection,
      ThemenIntroCollection,
    ],
  },
});
