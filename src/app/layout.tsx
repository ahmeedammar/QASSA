// Root layout required by the App Router. The document (html/body) lives in
// the [locale] layout so it can set lang and dir per locale.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
