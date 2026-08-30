"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  ClipboardList,
  Compass,
  History,
  User,
  type LucideIcon,
} from "lucide-react";
import { BrandLockup } from "@/components/brand";
import { NotificationBell } from "@/components/notification-bell";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

type Item = { href: string; label: string; short: string; icon: LucideIcon };

const WORKER: Item[] = [
  { href: "/jobs", label: "Discover Jobs", short: "Discover", icon: Compass },
  { href: "/applied", label: "Applied Jobs", short: "Applied", icon: ClipboardList },
  { href: "/history", label: "History", short: "History", icon: History },
  { href: "/profile", label: "Profile", short: "Profile", icon: User },
];

const EMPLOYER: Item[] = [
  { href: "/posted", label: "Posted Jobs", short: "Posted", icon: Briefcase },
  { href: "/profile", label: "Profile", short: "Profile", icon: User },
];

export const navFor = (role: Role) => (role === "employer" ? EMPLOYER : WORKER);

const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/** Desktop only. The sketch puts the account and its navigation to the side. */
export function Sidebar({ name, role }: { name: string; role: Role }) {
  const pathname = usePathname();
  const items = navFor(role);

  return (
    <aside className="hidden w-64 shrink-0 lg:block">
      <div className="sticky top-6">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-base font-semibold text-primary">
              {name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{name}</p>
              <p className="text-xs text-muted-foreground capitalize">{role}</p>
            </div>
            <NotificationBell className="-mr-1 shrink-0" />
          </div>
        </div>

        <nav className="mt-3 grid gap-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className="size-4.5" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

/** Mobile only. Same destinations, thumb-reachable. */
export function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = navFor(role);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur lg:hidden">
      <div
        className="mx-auto grid max-w-lg"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map(({ href, short, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className={cn("size-5.5", active && "stroke-[2.4]")} />
              {short}
            </Link>
          );
        })}
      </div>
      <div style={{ height: "env(safe-area-inset-bottom)" }} />
    </nav>
  );
}

/** Mobile only. */
export function TopBar({ name }: { name: string }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
      <BrandLockup className="scale-95 origin-left" />
      <div className="flex items-center gap-1">
        <NotificationBell />
        <Link
          href="/profile"
          aria-label="Your profile"
          className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-primary"
        >
          {name.slice(0, 1).toUpperCase()}
        </Link>
      </div>
    </header>
  );
}
