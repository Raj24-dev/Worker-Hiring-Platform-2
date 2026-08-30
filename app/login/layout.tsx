export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col bg-secondary/40 px-5 py-8 sm:justify-center sm:py-12">
      <div className="w-full max-w-md sm:mx-auto">{children}</div>
    </main>
  );
}
