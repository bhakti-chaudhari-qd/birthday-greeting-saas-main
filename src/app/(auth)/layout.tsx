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
