// Legt einen Sub-Section-Ordner unter content/german/{projekt|member|help}/
// an, indem zwei Dokumente über Tinas eigene `createDocument`-Mutation
// erzeugt werden:
//
//   1. `<slug>/_index.md`   — Section-Landing für Hugo, sonst 404 auf
//      `/projekt/<slug>/`. Liegt schema-seitig in der section_intro-
//      Collection (Kopftexte), die `**/_index` indiziert.
//   2. `<slug>/neuer-eintrag.md` — Sichtbarer Platzhalter im Listing der
//      projekt/member/help-Collection, damit der Ordner dort überhaupt
//      auftaucht (die Collection schließt `**/_index` per `match.exclude`
//      aus, weil das zur section_intro gehört).
//
// Beide Calls laufen über den generierten databaseClient, also denselben
// resolve()-Pfad wie /api/tina/[...routes]: das schreibt MongoDB-Index
// UND committet via GitProvider in einem Rutsch — die Einträge erscheinen
// sofort in der Tina-UI und nach dem nächsten Hugo-Build im Live-Site.

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

// Ein einzelnes Dokument via Tina-Mutation anlegen. Liefert `existed=true`,
// wenn Tina mit "already exists" antwortet (idempotent), wirft sonst.
async function createOne(args: {
  collection: string;
  relativePath: string;
  params: Record<string, unknown>;
}): Promise<{ existed: boolean }> {
  const result: any = await databaseClient.request({
    query: CREATE_DOCUMENT_GQL,
    variables: {
      collection: args.collection,
      relativePath: args.relativePath,
      params: { [args.collection]: args.params },
    },
    user: undefined,
  });
  const errors = result?.errors;
  if (errors && errors.length > 0) {
    const msg = errors[0]?.message || "createDocument failed";
    if (/already exists/i.test(msg)) return { existed: true };
    throw new Error(msg);
  }
  return { existed: false };
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

    const folderPath = `content/german/${collection}/${slug}`;

    // Reihenfolge egal — beide Dateien landen im gleichen Ordner. Wir
    // legen das `_index.md` zuerst an, weil das semantisch die
    // Section-Landing ist; der Platzhalter folgt danach.
    //
    // `draft: false` ist absichtlich gesetzt: Hugo überspringt
    // `draft: true` im Production-Build und liefert dann 404 für die
    // neue Section. Editor:innen können nachträglich auf draft
    // umstellen, wenn sie den Eintrag erst mal verstecken wollen.
    const indexResult = await createOne({
      collection: "section_intro",
      relativePath: `${collection}/${slug}/_index.md`,
      params: {
        title,
        description: "",
        draft: false,
      },
    });

    const placeholderResult = await createOne({
      collection,
      relativePath: `${slug}/neuer-eintrag.md`,
      params: {
        title: "Neuer Eintrag",
        description: "",
        draft: false,
      },
    });

    return res.json({
      ok: true,
      path: folderPath,
      alreadyExists: indexResult.existed && placeholderResult.existed,
    });
  } catch (err: any) {
    const msg = err?.message || "unknown error";
    return res.status(500).json({ error: msg });
  }
}
