// Listet Bilder + Unterordner unter assets/images/uploads/ vom konfigurierten
// Branch. Tina ruft diesen Endpunkt auch beim Klick auf einen Ordner auf —
// dann kommt der Pfad als ?directory=assets/images/uploads/<sub> rein.
// CMS-Uploads sind bewusst in einem eigenen Unterordner getrennt von den
// Theme-Assets unter assets/images/.

import type { NextApiRequest, NextApiResponse } from "next";

const OWNER = process.env.GITHUB_OWNER || "statthus-husum";
const REPO = process.env.GITHUB_REPO || "statthus-website";
const BRANCH = process.env.GITHUB_BRANCH || "staging";
const TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN!;
const MEDIA_DIR = "assets/images/uploads";

function isAuthed(req: NextApiRequest) {
  const cookies = req.cookies || {};
  return Boolean(
    cookies["next-auth.session-token"] ||
      cookies["__Secure-next-auth.session-token"],
  );
}

// Stellt sicher, dass das angefragte Verzeichnis innerhalb von MEDIA_DIR
// liegt — verhindert ein Auflisten anderer Repo-Bereiche via gefälschtem
// ?directory-Parameter.
function safeMediaDir(raw: string): string | null {
  const trimmed = (raw || "").trim().replace(/^\/+|\/+$/g, "");
  if (!trimmed) return MEDIA_DIR;
  if (trimmed.includes("..")) return null;
  if (trimmed === MEDIA_DIR) return trimmed;
  if (trimmed.startsWith(MEDIA_DIR + "/")) return trimmed;
  return null;
}

function relFromAssets(path: string): string {
  return path.startsWith("assets/") ? path.slice("assets/".length) : path;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!isAuthed(req)) return res.status(401).json({ error: "Not authenticated" });
  if (!TOKEN) return res.status(500).json({ error: "GitHub token not set" });

  const directory = safeMediaDir(String(req.query.directory || ""));
  if (!directory) {
    return res.status(400).json({ error: "invalid directory" });
  }

  try {
    const ghRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURI(directory)}?ref=${BRANCH}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );

    if (ghRes.status === 404) {
      return res.json({ items: [], totalCount: 0, offset: 0, limit: 0 });
    }
    if (!ghRes.ok) {
      const errBody = await ghRes.json().catch(() => ({}));
      return res.status(502).json({ error: errBody.message || "GitHub list failed" });
    }

    const contents = await ghRes.json();
    const entries = Array.isArray(contents) ? contents : [];

    // Ordner zuerst, dann Dateien — innerhalb der Gruppen alphabetisch.
    entries.sort((a: any, b: any) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name, "de");
    });

    const items = entries
      .filter((e: any) => e.type === "file" || e.type === "dir")
      .map((e: any) => {
        if (e.type === "dir") {
          return {
            type: "dir",
            id: e.path,
            filename: e.name,
            directory,
          };
        }
        const src = relFromAssets(e.path);
        return {
          type: "file",
          id: e.path,
          filename: e.name,
          directory,
          src,
          thumbnails: {
            "75x75": src,
            "400x400": src,
            "1000x1000": src,
          },
        };
      });

    return res.json({
      items,
      totalCount: items.length,
      offset: 0,
      limit: items.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
