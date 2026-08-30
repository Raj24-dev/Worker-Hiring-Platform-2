"use client";

import { useState, useTransition } from "react";
import { LogOut, Trash2 } from "lucide-react";
import { deleteAccount, signOut } from "@/actions/auth";
import { Button } from "@/components/ui/button";

/** "sign out" and "delete acc" from the profile sketch. */
export function AccountActions() {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  return (
    <section className="rounded-xl border bg-card p-5">
      <h3 className="mb-3 font-semibold">Account</h3>

      <Button
        type="button"
        variant="outline"
        className="w-full justify-start"
        disabled={pending}
        onClick={() => start(() => void signOut())}
      >
        <LogOut className="size-4" />
        Sign out
      </Button>

      {confirming ? (
        <div className="mt-3 rounded-lg bg-danger-soft p-4">
          <p className="text-sm font-medium text-destructive">
            Delete your account for good?
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your profile, applications and history are removed. This cannot be undone.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => start(() => void deleteAccount())}
            >
              Yes, delete my account
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          className="mt-2 w-full justify-start text-destructive hover:bg-danger-soft hover:text-destructive"
          onClick={() => setConfirming(true)}
        >
          <Trash2 className="size-4" />
          Delete account
        </Button>
      )}
    </section>
  );
}
