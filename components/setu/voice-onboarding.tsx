"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, Keyboard, PencilLine, RotateCcw, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  REQUIRED_FIELDS,
  SETU_GREETING,
  SETU_LANGUAGES,
  isSetuLanguage,
  type SetuField,
  type SetuLanguage,
  type SetuProfile,
} from "@/lib/setu/core";
import { playAudio, startRecording, type Recorder } from "@/lib/setu/audio";
import { cn } from "@/lib/utils";
import { Orb, type OrbState } from "./orb";

const FIELD_LABEL: Record<SetuField, string> = {
  name: "Name",
  position: "Trade",
  experience_years: "Experience",
  skills: "Skills",
  has_tools: "Tools",
  availability: "Availability",
  location: "Area",
  past_work: "Past work",
  references_info: "Reference",
};

type Line = { who: "setu" | "you"; text: string };

export function VoiceOnboarding({
  knownName,
  initialProfile = {},
}: {
  knownName: string;
  /** What Setu already gathered before the conversation was interrupted. */
  initialProfile?: SetuProfile;
}) {
  const router = useRouter();
  const orbRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<Recorder | null>(null);
  const stopAudioRef = useRef<(() => void) | null>(null);
  const rafRef = useRef(0);
  const busyRef = useRef(false);

  const [stage, setStage] = useState<"language" | "talking" | "done">("language");
  const [language, setLanguage] = useState<SetuLanguage>("hi-IN");
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [profile, setProfile] = useState<SetuProfile>(
    Object.keys(initialProfile).length ? initialProfile : knownName ? { name: knownName } : {},
  );
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");

  const historyRef = useRef<{ role: "user" | "model"; text: string }[]>([]);
  const amp = useCallback((v: number) => {
    orbRef.current?.style.setProperty("--amp", v.toFixed(3));
  }, []);

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      recorderRef.current?.cancel();
      stopAudioRef.current?.();
    },
    [],
  );

  const say = useCallback(
    (text: string, audio: string | null) =>
      new Promise<void>((resolve) => {
        if (!audio) {
          setOrbState("idle");
          resolve();
          return;
        }
        setOrbState("speaking");
        stopAudioRef.current = playAudio(audio, amp, () => {
          stopAudioRef.current = null;
          amp(0);
          setOrbState("idle");
          resolve();
        });
      }),
    [amp],
  );

  /** Sends one turn to Setu and speaks the answer. */
  const send = useCallback(
    async (message: string) => {
      setLines((l) => [...l, { who: "you", text: message }]);
      setOrbState("thinking");
      setError(null);

      try {
        const res = await fetch("/api/setu/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, language, profile, history: historyRef.current }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Setu could not answer.");

        historyRef.current = [
          ...historyRef.current,
          { role: "user" as const, text: message },
          { role: "model" as const, text: String(data.reply) },
        ].slice(-20);

        setProfile(data.profile ?? {});
        setLines((l) => [...l, { who: "setu", text: data.reply }]);
        await say(data.reply, data.audio);

        if (data.done) setStage("done");
      } catch (err) {
        setOrbState("idle");
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    },
    [language, profile, say],
  );

  /** Stops the mic, transcribes, and hands the words to Setu. */
  const finishTurn = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || busyRef.current) return;
    busyRef.current = true;
    recorderRef.current = null;

    cancelAnimationFrame(rafRef.current);
    amp(0);
    setOrbState("thinking");

    try {
      const wav = await recorder.stop();
      if (!wav) throw new Error("I did not catch that. Please try once more.");

      const form = new FormData();
      form.append("audio", wav, "speech.wav");
      form.append("language", language);

      const res = await fetch("/api/setu/stt", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not hear that.");
      if (!data.transcript) throw new Error("I did not catch that. Please try once more.");

      // They answered in a different language than they picked — follow them.
      if (
        data.language &&
        isSetuLanguage(data.language) &&
        data.language !== language &&
        (data.confidence ?? 0) > 0.8
      ) {
        setLanguage(data.language);
      }

      await send(data.transcript);
    } catch (err) {
      setOrbState("idle");
      setError(err instanceof Error ? err.message : "Could not hear that.");
    } finally {
      busyRef.current = false;
    }
  }, [amp, language, send]);

  const listen = useCallback(async () => {
    if (busyRef.current || recorderRef.current) return;
    stopAudioRef.current?.();
    setError(null);

    try {
      const recorder = await startRecording(() => void finishTurn());
      recorderRef.current = recorder;
      setOrbState("listening");

      const tick = () => {
        amp(Math.min(1, recorder.level() * 2.6));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setError("I need permission to use the microphone. You can also type your answer.");
      setTyping(true);
    }
  }, [amp, finishTurn]);

  /** "Say again" — re-speaks Setu's last line for anyone who missed it. */
  const replay = useCallback(async () => {
    const last = [...lines].reverse().find((l) => l.who === "setu");
    if (!last) return;
    setOrbState("thinking");
    try {
      const res = await fetch("/api/setu/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: last.text, language }),
      });
      const data = await res.json();
      await say(last.text, res.ok ? data.audio : null);
    } catch {
      setOrbState("idle");
    }
  }, [lines, language, say]);

  const begin = useCallback(
    async (lang: SetuLanguage) => {
      setLanguage(lang);
      setStage("talking");
      const greeting = SETU_GREETING[lang];
      setLines([{ who: "setu", text: greeting }]);
      historyRef.current = [{ role: "model", text: greeting }];

      setOrbState("thinking");
      try {
        const res = await fetch("/api/setu/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: greeting, language: lang }),
        });
        const data = await res.json();
        await say(greeting, res.ok ? data.audio : null);
      } catch {
        setOrbState("idle");
      }
    },
    [say],
  );

  const captured = REQUIRED_FIELDS.filter((f) => !!profile[f]?.trim()).length;
  const pct = Math.round((captured / REQUIRED_FIELDS.length) * 100);

  // ── Language ──────────────────────────────────────────────────────────────
  if (stage === "language") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-5 py-10">
        <div className="flex flex-col items-center text-center">
          <Orb state="idle" size={132} />
          <h1 className="mt-7 text-2xl font-semibold tracking-tight">
            Talk to Setu instead of typing
          </h1>
          <p className="mt-2 text-muted-foreground">
            Answer a few questions out loud and Setu builds your profile for you.
          </p>
        </div>

        <p className="mt-9 mb-3 text-center text-sm font-medium">Which language do you speak?</p>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(SETU_LANGUAGES).map(([code, { label }]) => (
            <button
              key={code}
              type="button"
              onClick={() => setLanguage(code as SetuLanguage)}
              aria-pressed={language === code}
              className={cn(
                "rounded-xl border-2 px-2 py-3 text-sm font-medium transition-all",
                language === code
                  ? "border-primary bg-brand-soft text-primary"
                  : "border-border bg-card hover:border-primary/40",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <Button size="xl" className="mt-6 w-full" onClick={() => void begin(language)}>
          Start talking
          <ArrowRight className="size-5" />
        </Button>
        <Button asChild variant="ghost" className="mt-2 w-full">
          <Link href="/onboarding/worker/form">
            <PencilLine className="size-4" />
            I will fill the form myself
          </Link>
        </Button>
      </main>
    );
  }

  // ── Finished ──────────────────────────────────────────────────────────────
  if (stage === "done") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center px-5 py-10 text-center">
        <span className="flex size-20 items-center justify-center rounded-full bg-success-soft">
          <Check className="size-10 text-success" strokeWidth={3} />
        </span>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Your profile is ready</h1>
        <p className="mt-2 text-muted-foreground">
          Setu saved everything you said. Check it over and change anything that is not right.
        </p>

        <div className="mt-7 grid w-full gap-2 text-left">
          {REQUIRED_FIELDS.filter((f) => profile[f]).map((f) => (
            <div key={f} className="rounded-lg border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">{FIELD_LABEL[f]}</p>
              <p className="mt-0.5 font-medium">{profile[f]}</p>
            </div>
          ))}
        </div>

        <Button size="xl" className="mt-7 w-full" onClick={() => router.replace("/profile/edit")}>
          Check my profile
          <ArrowRight className="size-5" />
        </Button>
      </main>
    );
  }

  // ── Conversation ──────────────────────────────────────────────────────────
  const hint =
    orbState === "listening"
      ? "Listening… speak now"
      : orbState === "thinking"
        ? "One moment…"
        : orbState === "speaking"
          ? "Setu is speaking"
          : "Tap the circle and answer";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 py-6">
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">{pct}%</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {REQUIRED_FIELDS.map((f) => (
          <span
            key={f}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              profile[f]
                ? "bg-success-soft text-success"
                : "bg-secondary text-muted-foreground",
            )}
          >
            {profile[f] && <Check className="mr-1 inline size-3" strokeWidth={3} />}
            {FIELD_LABEL[f]}
          </span>
        ))}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-6">
        <button
          type="button"
          onClick={orbState === "listening" ? () => void finishTurn() : () => void listen()}
          disabled={orbState === "thinking"}
          aria-label={orbState === "listening" ? "Stop and send" : "Tap to speak"}
          className="rounded-full transition-transform focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none active:scale-95 disabled:cursor-wait"
        >
          <Orb ref={orbRef} state={orbState} />
        </button>

        <p className="mt-6 text-sm font-medium text-muted-foreground" aria-live="polite">
          {hint}
        </p>

        {lines.length > 0 && (
          <p className="mt-4 max-w-md text-center text-lg leading-relaxed text-balance">
            {lines[lines.length - 1].text}
          </p>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-4 py-2.5 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      {typing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const text = typed.trim();
            if (!text) return;
            setTyped("");
            void send(text);
          }}
          className="flex gap-2"
        >
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Type your answer"
            autoFocus
            className="h-12 text-base md:text-base"
          />
          <Button type="submit" size="icon-lg" className="size-12" aria-label="Send">
            <Send className="size-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="size-12"
            aria-label="Close typing"
            onClick={() => setTyping(false)}
          >
            <X className="size-5" />
          </Button>
        </form>
      ) : (
        <div className="flex items-center justify-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setTyping(true)}>
            <Keyboard className="size-4" />
            Type instead
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void replay()}
            disabled={orbState !== "idle" || !lines.length}
          >
            <RotateCcw className="size-4" />
            Say again
          </Button>
        </div>
      )}
    </main>
  );
}
