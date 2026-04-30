import Link from "next/link";

type Tile = {
  href?: string;
  external?: boolean;
  title: string;
  description: string;
  badge?: string;
  disabled?: boolean;
};

const tiles: Tile[] = [
  {
    href: "/admin/index.html",
    external: true,
    title: "Website-Inhalt verwalten",
    description:
      "Veranstaltungen, News, Bewohner:innen-Steckbriefe und Themen-Texte bearbeiten.",
  },
  {
    href: "/freigabe/",
    external: true,
    title: "Publikationen freigeben",
    description:
      "Geänderte Inhalte vom Redaktions-Branch auf die Live-Site übertragen.",
  },
  {
    href: "/anleitung",
    title: "Anleitung",
    description:
      "Wie Inhalte erstellt, geprüft und veröffentlicht werden — der Redaktions-Workflow auf einen Blick.",
  },
  {
    title: "Newsletter erstellen",
    description: "Brevo-Anbindung für E-Mail-Versand — in Vorbereitung.",
    badge: "kommt bald",
    disabled: true,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <header className="mb-12">
          <h1 className="text-4xl font-bold text-slate-900">staTThus CMS</h1>
          <p className="mt-2 text-slate-600">
            Redaktions-Backend für statthus-husum.de
          </p>
        </header>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {tiles.map((tile) => (
            <TileCard key={tile.title} tile={tile} />
          ))}
        </div>

        <footer className="mt-16 text-sm text-slate-500">
          Bei Fragen oder Problemen: an die staTThus-Webredaktion wenden.
        </footer>
      </div>
    </main>
  );
}

function TileCard({ tile }: { tile: Tile }) {
  const card = (
    <div
      className={`group h-full rounded-xl border bg-white p-6 shadow-sm transition ${
        tile.disabled
          ? "cursor-not-allowed border-slate-200 opacity-60"
          : "border-slate-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">{tile.title}</h2>
        {tile.badge && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
            {tile.badge}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {tile.description}
      </p>
    </div>
  );

  if (tile.disabled || !tile.href) {
    return <div aria-disabled="true">{card}</div>;
  }
  if (tile.external) {
    return (
      <a href={tile.href} className="block focus:outline-none">
        {card}
      </a>
    );
  }
  return (
    <Link href={tile.href} className="block focus:outline-none">
      {card}
    </Link>
  );
}
