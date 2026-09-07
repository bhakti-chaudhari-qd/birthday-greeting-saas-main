export const dynamic = "force-dynamic";

/** Former AI studio route now redirects; no Owner gate required. */
export default function AiStudioLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
