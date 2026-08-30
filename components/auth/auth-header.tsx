import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLockup } from "@/components/brand";

export function AuthHeader({ back = "/login", title }: { back?: string; title?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <Link
          href={back}
          className="-ml-2 inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Go back"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <BrandLockup className="scale-90 origin-right" />
      </div>
      {title ? (
        <h1 className="mt-7 text-2xl font-semibold tracking-tight">{title}</h1>
      ) : null}
    </div>
  );
}
