// Legt einen Sub-Section-Ordner unter content/german/{projekt|member|help}/
// an, indem eine sichtbare Platzhalter-Datei `neuer-eintrag.md` mit
// Default-Frontmatter committet wird. Tinas Default-"Add Folder"-Flow
// funktioniert in unserem self-hosted Setup (MongoDB + GitHub) nicht —
// dieser Endpunkt ersetzt ihn.
//
// Warum kein `_index.md`? Die projekt/member/help-Collections schließen
// `**/_index` per `match.exclude` aus (das `_index.md` der Section-Landing
// gehört zur section_intro-Collection). Ein leerer Ordner mit nur
// `_index.md` wäre für Tina also unsichtbar — die Editor:in fände den
// frisch angelegten Ordner nirgends im Listing wieder. Eine reguläre
// `.md`-Datei ist hingegen direkt sichtbar, kann umbenannt oder mit
// echtem Inhalt gefüllt werden.

import type { NextApiRequest, NextApiResponse } from "next";

const OWNER = process.env.GITHUB_OWNER || "statthus-husum";
const REPO = process.env.GITHUB_REPO || "statthus-website";
const BRANCH = process.env.GITHUB_BRANCH || "staging";
const TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN!;

// Welche Tina-Collections dürfen Ordner anlegen? Spiegelt die Allowlist
// aus admin-tweaks.js.
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end();
  if (!isAuthed(req)) return res.status(401).json({ error: "Not authenticated" });
  if (!TOKEN) return res.status(500).json({ error: "GitHub token not set" });

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
    const placeholderPath = `${folderPath}/neuer-eintrag.md`;

    // Idempotenz: existiert der Ordner schon (egal mit welchen Dateien),
    // brechen wir ab statt einen Doppel-Platzhalter reinzulegen. GitHubs
    // Contents-API liefert für einen Ordner 200 + Array, für eine Datei
    // 200 + Objekt, sonst 404.
    const existsRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURI(folderPath)}?ref=${BRANCH}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );
    if (existsRes.ok) {
      return res.json({ ok: true, path: folderPath, alreadyExists: true });
    }

    const safeTitle = title.replace(/"/g, '\\"');
    const placeholderBody = `---
title: "${safeTitle}"
description: ""
draft: true
---
`;
    const content = Buffer.from(placeholderBody, "utf-8").toString("base64");

    const ghRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURI(placeholderPath)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          message: `Tina: Sub-Section ${collection}/${slug} angelegt (Platzhalter)`,
          content,
          branch: BRANCH,
        }),
      },
    );

    if (!ghRes.ok) {
      const errBody = await ghRes.json().catch(() => ({}));
      return res
        .status(502)
        .json({ error: errBody.message || "GitHub create failed" });
    }

    return res.json({ ok: true, path: folderPath });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
