// Static pages, so Next sends a long shared-cache TTL by default - the
// VPS's nginx has no deploy-aware invalidation, so an unbounded TTL means
// a stale build could get stuck in its cache indefinitely. Bound it here
// instead, for every page in this route group.
export const revalidate = 300;

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f4ef] px-4 py-12">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
