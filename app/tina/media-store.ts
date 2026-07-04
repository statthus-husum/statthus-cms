// Custom Media Store — Bilder liegen im Hetzner-S3-Media-Bucket und werden
// first-party über https://schreibe.statthus-husum.de/uploads/... ausgeliefert
// (Caddy-Proxy auf der CMS-VM, siehe lib/media-s3.ts für das Key-Layout).
//
// Frontmatter-Konvention: absolute URL — das Hugo-Theme-Partial image.html
// reicht http(s)-Quellen unverändert als <img src> durch. Alt-Bestand mit
// relativen "images/..."-Pfaden (aus der Git-Ära des Media-Stores) bleibt
// im Website-Repo liegen; previewSrc() mappt ihn weiterhin auf
// raw.githubusercontent, damit die Admin-Vorschau funktioniert.
//
// Auf der Backend-Seite läuft alles über /api/media/* in pages/api/media/.

import type {
  Media,
  MediaList,
  MediaListOptions,
  MediaUploadOptions,
} from "tinacms";

const RAW_BASE =
  process.env.NEXT_PUBLIC_GITHUB_RAW_BASE ||
  "https://raw.githubusercontent.com/statthus-husum/statthus-website/staging";

// Legacy-Werte (relative Pfade ohne führenden Slash) auf raw.githubusercontent
// mappen; absolute URLs (neuer S3-Bestand) unverändert lassen.
function toPreviewUrl(value: string | undefined | null): string {
  if (!value) return "";
  if (/^https?:\/\//.test(value)) return value;
  const relative = value.replace(/^\/+/, "");
  return `${RAW_BASE}/assets/${relative}`;
}

export default class S3MediaStore {
  accept = "image/*";

  // Was wird ins Frontmatter geschrieben? Die absolute Auslieferungs-URL —
  // persist()/list() setzen media.src bereits darauf.
  parse(media: Media): string {
    return media?.src || "";
  }

  // Tina ruft previewSrc(value) für vorhandene Bilder im Feld auf.
  // value ist der Frontmatter-String.
  previewSrc(value: string): string {
    return toPreviewUrl(value);
  }

  async persist(files: MediaUploadOptions[]): Promise<Media[]> {
    const out: Media[] = [];
    for (const f of files) {
      const fd = new FormData();
      fd.append("file", f.file);
      // Tina übergibt das Verzeichnis relativ zu publicFolder — der
      // Server normalisiert es auf die Bucket-Wurzel "uploads".
      fd.append("directory", f.directory || "");

      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Upload fehlgeschlagen: ${res.status} ${txt}`);
      }
      const result = await res.json();
      out.push({
        type: "file",
        id: result.id,
        filename: result.filename,
        directory: result.directory,
        src: result.src,
        thumbnails: {
          "75x75": result.thumb || result.src,
          "400x400": result.thumb || result.src,
          "1000x1000": result.src,
        },
      });
    }
    return out;
  }

  async list(options: MediaListOptions): Promise<MediaList> {
    const params = new URLSearchParams();
    if (options.directory) params.set("directory", options.directory);
    if (options.offset) params.set("offset", String(options.offset));
    if (options.limit) params.set("limit", String(options.limit));
    const res = await fetch(`/api/media/list?${params}`);
    if (!res.ok) {
      throw new Error(`List fehlgeschlagen: ${res.status}`);
    }
    const data = await res.json();
    // Server liefert bereits absolute src/thumbnails-URLs.
    return {
      items: data.items || [],
      nextOffset: data.nextOffset,
    };
  }

  async delete(media: Media): Promise<void> {
    const res = await fetch(
      `/api/media/delete?path=${encodeURIComponent(media.id)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Delete fehlgeschlagen: ${res.status} ${txt}`);
    }
  }
}
