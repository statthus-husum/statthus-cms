// Custom Media Store — committet Bilder direkt ins Hugo-Repo unter
// static/images/. Hugo serviert /static/* unter / (also wird die
// referenzierte URL "/images/foo.jpg" automatisch aufgelöst).
//
// Auf der Backend-Seite läuft das über /api/media/* in pages/api/media/.

import type {
  Media,
  MediaList,
  MediaListOptions,
  MediaUploadOptions,
} from "tinacms";

export default class GitHubMediaStore {
  accept = "image/*";

  async persist(files: MediaUploadOptions[]): Promise<Media[]> {
    const out: Media[] = [];
    for (const f of files) {
      const fd = new FormData();
      fd.append("file", f.file);
      // Tina übergibt das Verzeichnis relativ zu publicFolder — wir
      // ignorieren das und setzen static/images selbst.
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
        thumbnails: { "75x75": result.src, "400x400": result.src, "1000x1000": result.src },
      });
    }
    return out;
  }

  async previewSrc(publicUrl: string): Promise<{ src: string }> {
    // Falls das die Hugo-Pfad-Form ist (z.B. "/images/foo.jpg"), den
    // sehen wir auch live direkt vom GitHub-Raw-Server. Sonst durchreichen.
    return { src: publicUrl };
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
    return {
      items: data.items,
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
