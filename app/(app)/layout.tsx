import { BottomNav, Sidebar, TopBar } from "@/components/nav";
import { requireProfile } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();

  return (
    <>
      <TopBar name={profile.name} />
      {/* row-reverse puts the navigation on the right, as the sketch shows. */}
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-row-reverse justify-end gap-8 px-4 py-4 lg:px-6 lg:py-6">
        <Sidebar name={profile.name} role={profile.role} />
        <main className="min-w-0 flex-1 pb-24 lg:pb-6">{children}</main>
      </div>
      <BottomNav role={profile.role} />
    </>
  );
}
