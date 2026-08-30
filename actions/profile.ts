"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { requireWorker } from "@/lib/session";
import { domainForPosition } from "@/lib/setu/core";

const CERT_BUCKET = "certificates";

const editSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name"),
  location: z.string().trim().min(2, "Please enter your city or area"),
  contact: z.string().trim().max(20).optional().or(z.literal("")),
  position: z.string().trim().min(1, "Pick the work you do"),
  skills: z.string().trim().max(300).optional().or(z.literal("")),
  experience_years: z.string().trim().max(60).optional().or(z.literal("")),
  availability: z.string().trim().max(120).optional().or(z.literal("")),
  has_tools: z.enum(["yes", "no"]),
  remarks: z.string().trim().max(600).optional().or(z.literal("")),
});

/**
 * "After collecting and saving those infos there will be an option for editing
 * the profile." Everything Setu heard is editable here, including the remarks
 * it wrote — they are the worker's words, so the worker gets the last say.
 */
export async function updateWorkerProfile(input: z.input<typeof editSchema>) {
  const { profile } = await requireWorker();

  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const match = domainForPosition(d.position);

  const { error: profileError } = await admin
    .from("profiles")
    .update({ name: d.name })
    .eq("id", profile.id);
  if (profileError) return { ok: false as const, error: "Could not save. Please try again." };

  const { error } = await admin
    .from("workers")
    .update({
      name: d.name,
      location: d.location,
      contact: d.contact || null,
      domain: match?.domain ?? null,
      sub_domain: match?.position ?? d.position,
      skills: d.skills || match?.position || null,
      experience_years: d.experience_years || null,
      availability: d.availability || null,
      has_tools: d.has_tools,
      remarks: d.remarks || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (error) return { ok: false as const, error: "Could not save. Please try again." };

  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { ok: true as const };
}

const MAX_CERT_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/** Certificates and documents are added by hand — Setu never invents these. */
export async function addCertificate(form: FormData) {
  const { profile } = await requireWorker();

  const name = String(form.get("name") ?? "").trim();
  const issuer = String(form.get("issuer") ?? "").trim();
  const file = form.get("file");

  if (name.length < 2) return { ok: false as const, error: "Give the certificate a name" };

  let path: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_CERT_BYTES) {
      return { ok: false as const, error: "That file is larger than 5 MB" };
    }
    if (!ALLOWED.includes(file.type)) {
      return { ok: false as const, error: "Use a photo (JPG, PNG) or a PDF" };
    }

    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    path = `${profile.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from(CERT_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) return { ok: false as const, error: "Could not upload that file." };
  }

  const { error } = await admin.from("certificates").insert({
    worker_id: profile.id,
    name,
    issuer: issuer || null,
    certificate_url: path,
    verification_status: "pending",
  });

  if (error) {
    if (path) await admin.storage.from(CERT_BUCKET).remove([path]);
    return { ok: false as const, error: "Could not save that certificate." };
  }

  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { ok: true as const };
}

export async function deleteCertificate(id: number) {
  const { profile } = await requireWorker();

  const { data: cert } = await admin
    .from("certificates")
    .select("id, worker_id, certificate_url")
    .eq("id", id)
    .maybeSingle<{ id: number; worker_id: string; certificate_url: string | null }>();

  if (!cert || cert.worker_id !== profile.id) {
    return { ok: false as const, error: "That certificate is not yours." };
  }

  await admin.from("certificates").delete().eq("id", id);
  if (cert.certificate_url) {
    await admin.storage.from(CERT_BUCKET).remove([cert.certificate_url]);
  }

  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { ok: true as const };
}

/** The bucket is private, so viewing a document needs a short-lived link. */
export async function certificateLink(id: number) {
  const { profile } = await requireWorker();

  const { data: cert } = await admin
    .from("certificates")
    .select("worker_id, certificate_url")
    .eq("id", id)
    .maybeSingle<{ worker_id: string; certificate_url: string | null }>();

  if (!cert?.certificate_url || cert.worker_id !== profile.id) return { ok: false as const };

  const { data } = await admin.storage
    .from(CERT_BUCKET)
    .createSignedUrl(cert.certificate_url, 60);

  return data?.signedUrl ? { ok: true as const, url: data.signedUrl } : { ok: false as const };
}
