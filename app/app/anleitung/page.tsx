import Link from "next/link";

export const metadata = {
  title: "Anleitung — staTThus CMS",
};

export default function Anleitung() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← Übersicht
        </Link>

        <h1 className="mt-4 text-3xl font-bold text-slate-900">Anleitung</h1>
        <p className="mt-2 text-slate-600">
          So entstehen neue Inhalte auf statthus-husum.de — vom Entwurf bis zur
          Veröffentlichung.
        </p>

        <ol className="mt-10 space-y-8">
          <Step
            number={1}
            title="Anmelden"
            body={
              <>
                Im{" "}
                <a
                  href="/admin/index.html"
                  className="font-medium text-teal-700 underline"
                >
                  Redaktions-Bereich
                </a>{" "}
                mit Email und Passwort einloggen. Beim ersten Login wirst du
                aufgefordert, dein Passwort zu ändern.
              </>
            }
          />
          <Step
            number={2}
            title="Inhalt bearbeiten oder neu anlegen"
            body={
              <>
                Im Menü links die Sammlung wählen — Veranstaltungen, News,
                Bewohner:innen-Steckbriefe oder Themen-Texte. „Create New" für
                neue Einträge, oder einen bestehenden Eintrag anklicken.
                Änderungen werden mit „Save" gesichert. Bilder lädt man über
                den Media-Manager hoch — sie landen automatisch im richtigen
                Verzeichnis.
              </>
            }
          />
          <Step
            number={3}
            title="Änderungen sammeln im Redaktions-Branch"
            body={
              <>
                Jedes Speichern erzeugt einen Commit auf dem
                <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-sm">
                  staging
                </code>
                -Branch des Hugo-Repos. Die Live-Site wird dabei{" "}
                <em>noch nicht</em> aktualisiert — das passiert erst in Schritt
                4. Du kannst beliebig viele Änderungen sammeln, bevor du
                freigibst.
              </>
            }
          />
          <Step
            number={4}
            title="Freigabe — auf die Live-Site übernehmen"
            body={
              <>
                In der{" "}
                <a
                  href="/freigabe/"
                  className="font-medium text-teal-700 underline"
                >
                  Freigabe-App
                </a>{" "}
                erscheinen alle gesammelten Änderungen mit Diff-Vorschau. Per
                Häkchen auswählen und „Alle Änderungen freigeben" klicken — die
                ausgewählten Inhalte werden auf den{" "}
                <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-sm">
                  main
                </code>
                -Branch übernommen.
              </>
            }
          />
          <Step
            number={5}
            title="Hugo baut und deployt"
            body={
              <>
                Sobald
                <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-sm">
                  main
                </code>
                aktualisiert ist, läuft automatisch ein Hugo-Build über GitHub
                Actions. Nach 1–2 Minuten sind die neuen Inhalte unter{" "}
                <a
                  href="https://statthus-husum.de"
                  className="font-medium text-teal-700 underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  statthus-husum.de
                </a>{" "}
                live.
              </>
            }
          />
        </ol>

        <section className="mt-12 rounded-lg border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-base font-semibold text-slate-900">
            Tipps & Hinweise
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>
              <strong>Entwurfs-Schalter:</strong> Solange „Entwurf" aktiviert
              ist, erscheint ein Beitrag nicht auf der Live-Site — auch nach
              Freigabe nicht.
            </li>
            <li>
              <strong>Bilder:</strong> Werden als Original-Datei gespeichert —
              Hugo erzeugt daraus automatisch Web-Versionen in passender Größe.
              Original-Auflösung also gerne hoch.
            </li>
            <li>
              <strong>Konflikt in der Freigabe?</strong> Webredaktion
              ansprechen — manueller Merge in GitHub als Notfall-Pfad ist
              möglich.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}

function Step({
  number,
  title,
  body,
}: {
  number: number;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <li className="flex gap-5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-700 text-sm font-semibold text-white">
        {number}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-slate-700 leading-relaxed">{body}</p>
      </div>
    </li>
  );
}
