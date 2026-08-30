import "server-only";
import { admin } from "./supabase/admin";
import type { NotificationType } from "./types";

export type NewNotification = {
  profile_id: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  href?: string | null;
};

/**
 * Writing a notification must never be the reason a hire, a rejection or a job
 * post fails. Everything here logs and moves on — including the case where the
 * table does not exist yet because migration 0002 has not been run.
 */
export async function notify(rows: NewNotification | NewNotification[]) {
  const list = Array.isArray(rows) ? rows : [rows];
  if (!list.length) return;

  const { error } = await admin.from("notifications").insert(
    list.map((n) => ({
      profile_id: n.profile_id,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      href: n.href ?? null,
    })),
  );

  if (error) console.error("[notify] could not write notification:", error.message);
}
