import Link from "next/link";
import { redirect } from "next/navigation";
import { IdCard, Smartphone, ShieldCheck, MapPin, Wallet } from "lucide-react";
import { Logo, Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { getMe, landingFor } from "@/lib/session";

const points = [
  { icon: MapPin, text: "Work near you" },
  { icon: Wallet, text: "Pay shown upfront" },
  { icon: ShieldCheck, text: "Verified employers" },
];

export default async function LoginPage() {
  const me = await getMe();
  if (me) redirect(await landingFor(me.userId, me.profile));

  return (
    <div className="flex flex-col items-center text-center">
      <Logo size={64} />
      <Wordmark className="mt-5 text-3xl" />
      <p className="mt-2 text-balance text-muted-foreground">
        Find work near you. Hire skilled workers you can trust.
      </p>

      <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {points.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Icon className="size-4 text-primary" />
            {text}
          </li>
        ))}
      </ul>

      <div className="mt-9 grid w-full gap-3">
        <Button asChild size="xl" className="w-full justify-start gap-3">
          <Link href="/login/phone">
            <Smartphone className="size-5" />
            Login with phone number
          </Link>
        </Button>
        <Button asChild size="xl" variant="outline" className="w-full justify-start gap-3">
          <Link href="/login/aadhaar">
            <IdCard className="size-5" />
            Login with Aadhaar number
          </Link>
        </Button>
      </div>

      <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
        We send a one-time code to confirm it is you.
      </p>
    </div>
  );
}
