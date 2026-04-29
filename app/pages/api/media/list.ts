// Listet alle Bilder unter assets/images/ vom konfigurierten Branch.

import type { NextApiRequest, NextApiResponse } from "next";

const OWNER = process.env.GITHUB_OWNER || "statthus-husum";
const REPO = process.env.GITHUB_REPO || "statthus-website";
const BRANCH = process.env.GITHUB_BRANCH || "staging";
const TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN!;
const MEDIA_DIR = "assets/images";

function isAuthed(req: NextApiRequest) {
  const cookies = req.cookies || {};
  return Boolean(
    cookies["next-auth.session-token"] ||
      cookies["__Secure-next-auth.session-token"],
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!isAuthed(req)) return res.status(401).json({ error: "Not authenticated" });
  if (!TOKEN) return res.status(500).json({ error: "GitHub token not set" });

  try {
    const ghRes = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURI(MEDIA_DIR)}?ref=${BRANCH}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );

    if (ghRes.status === 404) {
      // Verzeichnis existiert noch nicht — leer zurück
      return res.json({ items: [], totalCount: 0, offset: 0, limit: 0 });
    }
    if (!ghRes.ok) {
      const errBody = await ghRes.json().catch(() => ({}));
      return res.status(502).json({ error: errBody.message || "GitHub list failed" });
    }

    const contents = await ghRes.json();
    const files = Array.isArray(contents) ? contents : [];

    const items = files
      .filter((f: any) => f.type === "file")
      .map((f: any) => {
        const src = `images/${f.name}`;
        return {
          type: "file",
          id: f.path,
          filename: f.name,
          directory: MEDIA_DIR,
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
