"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Undo2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppNotification, NotificationType } from "@/lib/types";

type Inbox = { items: AppNotification[]; unread: number };

const TONE: Record<NotificationType, { icon: LucideIcon; className: string }> = {
  hired: { icon: CheckCircle2, className: "bg-success-soft text-success" },
  rejected: { icon: XCircle, className: "bg-danger-soft text-destructive" },
  on_hold: { icon: PauseCircle, className: "bg-brand-soft text-primary" },
  released: { icon: PlayCircle, className: "bg-success-soft text-success" },
  job_match: { icon: BriefcaseBusiness, className: "bg-warning-soft text-accent-foreground" },
  withdrawn: { icon: Undo2, className: "bg-secondary text-secondary-foreground" },
  completed: { icon: CheckCircle2, className: "bg-secondary text-secondary-foreground" },
};

export function NotificationBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data } = useQuery<Inbox>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("Could not load notifications");
      return res.json();
    },
    // Cheap enough to keep roughly current without a socket.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const markRead = useMutation({
    mutationFn: () => fetch("/api/notifications", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;

  // Close on a click anywhere else, and on Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) markRead.mutate();
  }

  return (
    <div ref={panelRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className="relative flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          // On a phone the bell sits close to the edge, so anchoring the panel
          // to the button pushes it off screen. Pin it to the viewport there,
          // and only hang it off the button in the desktop sidebar.
          className={cn(
            "z-50 overflow-hidden rounded-xl border bg-popover shadow-lg",
            "fixed inset-x-3 top-[3.75rem]",
            "lg:absolute lg:inset-x-auto lg:top-full lg:right-0 lg:mt-2 lg:w-80",
          )}
        >
          <p className="border-b px-4 py-3 text-sm font-semibold">Notifications</p>

          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nothing yet. We will tell you when something happens with your jobs.
            </p>
          ) : (
            <ul className="max-h-[22rem] divide-y overflow-y-auto">
              {items.map((n) => {
                const tone = TONE[n.type] ?? TONE.completed;
                const Icon = tone.icon;
                const row = (
                  <div className="flex gap-3 px-4 py-3 text-left">
                    <span
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                        tone.className,
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-pretty">{n.title}</p>
                      {n.body && (
                        <p className="mt-0.5 text-sm text-muted-foreground text-pretty">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                    {!n.read_at && (
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                );

                return (
                  <li key={n.id} className={cn(!n.read_at && "bg-brand-soft/40")}>
                    {n.href ? (
                      <Link
                        href={n.href}
                        onClick={() => {
                          setOpen(false);
                          router.refresh();
                        }}
                        className="block transition-colors hover:bg-secondary/60"
                      >
                        {row}
                      </Link>
                    ) : (
                      row
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
