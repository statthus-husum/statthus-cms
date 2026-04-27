import "./globals.css";

export const metadata = {
  title: "staTThus CMS",
  description: "Inhalts-Editor für die staTThus-Website",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
