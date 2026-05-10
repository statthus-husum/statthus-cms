// Legt einen Sub-Section-Ordner unter content/german/{projekt|member|help}/
// an, indem zwei Dokumente direkt über das @tinacms/datalayer-`database`-
// Objekt geschrieben werden:
//
//   1. `<slug>/_index.md`   — Section-Landing für Hugo, sonst 404 auf
//      `/projekt/<slug>/`. Liegt schema-seitig in der section_intro-
//      Collection (Kopftexte), die `**/_index` indiziert.
//   2. `<slug>/neuer-eintrag.md` — Sichtbarer Platzhalter im Listing der
//      projekt/member/help-Collection, damit der Ordner dort überhaupt
//      auftaucht (die Collection schließt `**/_index` per `match.exclude`
//      aus, weil das zur section_intro gehört).
//
// `database.put(path, data, collection)` aus @tinacms/datalayer schreibt
// in einem Rutsch MongoDB-Index UND committet via GitProvider — der
// Umweg über die GraphQL-Mutation `createDocument` aktualisierte aus
// uns unbekannten Gründen nur GitHub, nicht den MongoDB-Index, sodass
// die Tina-UI die neuen Einträge erst nach Container-Restart zeigte
// (der Entrypoint baut den Index neu).

import type { NextApiRequest, NextApiResponse } from "next";

import database from "../../../tina/database";

const ALLOWED_COLLECTIONS = new Set(["projekt", "member", "help"]);

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

// Eine einzelne Datei anlegen, idempotent. Liefert `existed=true`, wenn
// schon eine Datei am Pfad steht — dann nicht überschreiben, sonst
// würden wir versehentlich Bestandsinhalt platt machen.
async function putOne(args: {
  fullPath: string;
  collection: string;
  data: Record<string, unknown>;
}): Promise<{ existed: boolean }> {
  const db = database as any;
  let existed = false;
  try {
    const current = await db.get(args.fullPath);
    if (current) existed = true;
  } catch {
    existed = false;
  }
  if (existed) return { existed: true };
  await db.put(args.fullPath, args.data, args.collection);
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
    const indexResult = await putOne({
      fullPath: `${folderPath}/_index.md`,
      collection: "section_intro",
      data: {
        title,
        description: "",
        draft: false,
      },
    });

    // Placeholder spiegelt das Format der bestehenden, von Hand bzw. via
    // Tina-UI editierten Abschnitt-Dateien: `weight` für Sortierung,
    // `image_position: right` als übliche Card-Variante, `cards: []` als
    // leerer Slot. KEIN `build.render: never` — sonst hätte Hugo dem
    // Platzhalter keine eigene URL gegeben, und ein Card-Link, der hierher
    // zeigt, würde auf die Parent-Section zurückfallen.
    const placeholderResult = await putOne({
      fullPath: `${folderPath}/neuer-eintrag.md`,
      collection,
      data: {
        title: "Neuer Eintrag",
        weight: 10,
        image_position: "right",
        draft: false,
        cards: [],
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
