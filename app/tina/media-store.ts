// Custom Media Store — committet Bilder direkt ins Hugo-Repo unter
// assets/images/. Das Hugo-Theme bindet Bilder über die assets/-Pipeline
// ein (resources.Get), daher müssen Uploads dorthin.
//
// Frontmatter-Konvention: relativer Pfad ohne führenden Slash, z.B.
// "images/foo.jpg" — so wie es das Theme aus assets/ aufzulösen erwartet.
// Damit Tina im Admin trotzdem eine Vorschau rendern kann (Tina baut
// Image-URLs als origin+value zusammen), liefern wir für die Preview
// eine vollständige raw.githubusercontent-URL via previewSrc().
//
// Auf der Backend-Seite läuft das über /api/media/* in pages/api/media/.

import type {
  Media,
  MediaList,
  MediaListOptions,
  MediaUploadOptions,
} from "tinacms";

const RAW_BASE =
  process.env.NEXT_PUBLIC_GITHUB_RAW_BASE ||
  "https://raw.githubusercontent.com/statthus-husum/statthus-website/staging";

function toRawUrl(value: string | undefined | null): string {
  if (!value) return "";
  if (/^https?:\/\//.test(value)) return value;
  const relative = value.replace(/^\/+/, "");
  return `${RAW_BASE}/assets/${relative}`;
}

export default class GitHubMediaStore {
  accept = "image/*";

  // Was wird ins Frontmatter geschrieben? Wir leiten den Wert aus media.id
  // ab (z.B. "assets/images/franz.png" → "images/franz.png"), damit das
  // Hugo-Theme den Pfad über resources.Get auflösen kann.
  parse(media: Media): string {
    const id = media?.id || "";
    if (id.startsWith("assets/")) return id.slice("assets/".length);
    return media?.src || "";
  }

  // Tina ruft previewSrc(value) für vorhandene Bilder im Feld auf.
  // value ist der Frontmatter-String (ohne Slash, ohne assets/-Prefix) —
  // wir mappen ihn auf raw.githubusercontent, sodass das Admin-UI die
  // Bilder direkt anzeigen kann.
  previewSrc(value: string): string {
    return toRawUrl(value);
  }

  async persist(files: MediaUploadOptions[]): Promise<Media[]> {
    const out: Media[] = [];
    for (const f of files) {
      const fd = new FormData();
      fd.append("file", f.file);
      // Tina übergibt das Verzeichnis relativ zu publicFolder — wir
      // ignorieren das und setzen assets/images selbst.
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
      const previewUrl = toRawUrl(result.src);
      out.push({
        type: "file",
        id: result.id,
        filename: result.filename,
        directory: result.directory,
        src: previewUrl,
        thumbnails: {
          "75x75": previewUrl,
          "400x400": previewUrl,
          "1000x1000": previewUrl,
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
    const items = (data.items || []).map((it: Media) => {
      const previewUrl = toRawUrl(it.src);
      return {
        ...it,
        src: previewUrl,
        thumbnails: {
          "75x75": previewUrl,
          "400x400": previewUrl,
          "1000x1000": previewUrl,
        },
      };
    });
    return {
      items,
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
