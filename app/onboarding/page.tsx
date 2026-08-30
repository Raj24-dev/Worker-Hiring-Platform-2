import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, HardHat } from "lucide-react";
import { BrandLockup } from "@/components/brand";
import { getMe, landingFor } from "@/lib/session";

const roles = [
  {
    href: "/onboarding/worker",
    icon: HardHat,
    title: "I want work",
    hint: "Find jobs near you and apply",
  },
  {
    href: "/onboarding/employer",
    icon: Briefcase,
    title: "I want to hire",
    hint: "Post a job and pick workers",
  },
];

export default async function OnboardingPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.profile) redirect(await landingFor(me.userId, me.profile));

  return (
    <main className="flex min-h-dvh flex-col px-5 py-8 sm:justify-center">
      <div className="mx-auto w-full max-w-lg">
        <BrandLockup />
        <h1 className="mt-8 text-2xl font-semibold tracking-tight">
          How will you use Karigaar?
        </h1>
        <p className="mt-1.5 text-muted-foreground">You can only pick one.</p>

        <div className="mt-7 grid gap-3">
          {roles.map(({ href, icon: Icon, title, hint }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-4 rounded-xl border-2 bg-card p-5 transition-all hover:border-primary/50 hover:shadow-sm"
            >
              <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-primary">
                <Icon className="size-7" />
              </span>
              <span>
                <span className="block text-lg font-semibold">{title}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{hint}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
