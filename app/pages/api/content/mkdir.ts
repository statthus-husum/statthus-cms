// Legt einen Sub-Section-Ordner unter content/german/{projekt|member|help}/
// an, indem über Tinas eigene `createDocument`-GraphQL-Mutation eine
// sichtbare Platzhalter-Datei `neuer-eintrag.md` mit Default-Frontmatter
// erzeugt wird.
//
// Warum nicht direkt via GitHub-REST-API committen? Weil dann nur das
// Repo aktualisiert wird, nicht aber Tinas MongoDB-Index. Die Tina-UI
// fragt gegen den Index — neu committete Dateien wären erst nach einem
// Container-Reindex sichtbar.
//
// Warum statt `createFolder` ein echtes Dokument? `createFolder`
// schreibt eine `.gitkeep.md` mit `_is_tina_folder_placeholder`-Marker.
// In unserem dual-backend-Setup (MongoDB + GitProvider) hat das
// historisch zu Index-/Sichtbarkeitsproblemen geführt. Ein echtes
// `createDocument` ist robuster: der Eintrag taucht direkt im Listing
// auf, die Editor:in kann ihn umbenennen oder mit Inhalt füllen.
//
// Warum kein `_index.md` als Platzhalter? Die projekt/member/help-
// Collections schließen `**/_index` per `match.exclude` aus
// (Section-Landings gehören zu themen-intro). Ein `_index.md` wäre also
// für Tina unsichtbar.

import type { NextApiRequest, NextApiResponse } from "next";

import databaseClient from "../../../tina/__generated__/databaseClient";

const ALLOWED_COLLECTIONS = new Set(["projekt", "member", "help"]);

const CREATE_DOCUMENT_GQL = `
mutation CreatePlaceholder($collection: String!, $relativePath: String!, $params: DocumentMutation!) {
  createDocument(
    collection: $collection
    relativePath: $relativePath
    params: $params
  ) {
    __typename
  }
}
`;

function isAuthed(req: NextApiRequest) {
  const cookies = req.cookies || {};
  return Boolean(
    cookies["next-auth.session-token"] ||
      cookies["__Secure-next-auth.session-token"],
  );
}

function slugify(value: string): string {
  return value
    .toString()
    .toLowerCase()
    .replace(/[äÄ]/g, "ae")
    .replace(/[öÖ]/g, "oe")
    .replace(/[üÜ]/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end();
  if (!isAuthed(req)) return res.status(401).json({ error: "Not authenticated" });

  try {
    const body = (req.body || {}) as { collection?: string; title?: string };
    const collection = (body.collection || "").trim();
    const title = (body.title || "").trim();

    if (!ALLOWED_COLLECTIONS.has(collection)) {
      return res.status(400).json({ error: "unknown collection" });
    }
    if (!title) {
      return res.status(400).json({ error: "title required" });
    }
    const slug = slugify(title);
    if (!slug) {
      return res
        .status(400)
        .json({ error: "title contains no usable slug characters" });
    }

    const relativePath = `${slug}/neuer-eintrag.md`;
    const folderPath = `content/german/${collection}/${slug}`;

    // Tinas createDocument: schreibt MongoDB-Index UND committet via
    // GitProvider in einem Rutsch. Bei Doppel-Anlage wirft Tina
    // "Unable to add document, ... already exists" — als idempotent OK
    // zurückspielen.
    const result: any = await databaseClient.request({
      query: CREATE_DOCUMENT_GQL,
      variables: {
        collection,
        relativePath,
        params: {
          [collection]: {
            title,
            description: "",
            draft: true,
          },
        },
      },
      // user-Feld bleibt leer — Auth wurde oben per Cookie geprüft,
      // die Mutation läuft mit den GitProvider-Credentials.
      user: undefined,
    });

    const errors = result?.errors;
    if (errors && errors.length > 0) {
      const msg = errors[0]?.message || "createDocument failed";
      if (/already exists/i.test(msg)) {
        return res.json({ ok: true, path: folderPath, alreadyExists: true });
      }
      return res.status(502).json({ error: msg });
    }

    return res.json({ ok: true, path: folderPath });
  } catch (err: any) {
    const msg = err?.message || "unknown error";
    if (/already exists/i.test(msg)) {
      return res.json({ ok: true, alreadyExists: true });
    }
    return res.status(500).json({ error: msg });
  }
}
