"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import {
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/page";

type SuggestedQuestion = { id: string; title: string };
type HelpLink = { label: string; href: string };

type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  links?: HelpLink[];
};

type BootstrapPayload = {
  data?: {
    suggestedQuestions?: SuggestedQuestion[];
    welcome?: string;
  };
  error?: { message?: string };
};

type ChatPayload = {
  data?: {
    answer?: string;
    links?: HelpLink[];
    suggestedQuestions?: SuggestedQuestion[];
    provider?: string;
  };
  error?: { message?: string };
};

const DEFAULT_WELCOME =
  "Hi! I can help with contacts, templates, automations, SMS/WhatsApp setup, roles, and billing. Ask in English, हिंदी, or मराठी - I'll reply in the same language.";

export function HelpChatWidget() {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [welcome, setWelcome] = useState(DEFAULT_WELCOME);
  const [suggested, setSuggested] = useState<SuggestedQuestion[]>([]);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const turnIdRef = useRef(0);

  function nextTurnId(prefix: string) {
    turnIdRef.current += 1;
    return `${prefix}-${turnIdRef.current}`;
  }

  useEffect(() => {
    if (!open || bootstrapped) {
      return;
    }

    let cancelled = false;

    async function loadBootstrap() {
      try {
        const response = await fetch("/api/v1/help/chat", {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        const payload = (await response.json()) as BootstrapPayload;
        if (!response.ok) {
          throw new Error(payload.error?.message ?? "Could not load help");
        }
        if (cancelled) return;
        setWelcome(payload.data?.welcome ?? DEFAULT_WELCOME);
        setSuggested(payload.data?.suggestedQuestions ?? []);
        setBootstrapped(true);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Could not load help questions",
        );
        setBootstrapped(true);
      }
    }

    void loadBootstrap();
    return () => {
      cancelled = true;
    };
  }, [open, bootstrapped]);

  useEffect(() => {
    if (!open) return;
    const node = listRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
    inputRef.current?.focus();
  }, [open, turns, loading]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function ask(question: string) {
    const message = question.trim();
    if (!message || loading) {
      return;
    }

    setError(null);
    setDraft("");
    const userTurn: ChatTurn = {
      id: nextTurnId("u"),
      role: "user",
      content: message,
    };
    setTurns((prev) => [...prev, userTurn]);
    setLoading(true);

    try {
      const history = [...turns, userTurn]
        .slice(-6)
        .map((turn) => ({ role: turn.role, content: turn.content }));

      const response = await fetch("/api/v1/help/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      const payload = (await response.json()) as ChatPayload;
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Could not get an answer");
      }

      const answer =
        payload.data?.answer?.trim() ||
        "I could not form an answer. Please try another question.";

      setTurns((prev) => [
        ...prev,
        {
          id: nextTurnId("a"),
          role: "assistant",
          content: answer,
          links: payload.data?.links ?? [],
        },
      ]);

      if (payload.data?.suggestedQuestions?.length) {
        setSuggested(payload.data.suggestedQuestions);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Help request failed");
      setTurns((prev) => [
        ...prev,
        {
          id: nextTurnId("a-err"),
          role: "assistant",
          content:
            "Sorry - I could not answer that just now. Please try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    void ask(draft);
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open ? (
        <section
          id={panelId}
          aria-label="Product help chat"
          className="pointer-events-auto flex h-[min(32rem,calc(100vh-6rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-[#fbfaf7] shadow-2xl shadow-stone-900/15"
        >
          <header className="flex items-start justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-stone-900">
                Product help
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-stone-500">
                Answers from product docs. I can&apos;t change your account.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="shrink-0 rounded-full px-2.5 py-1 text-sm font-medium text-stone-600 outline-none hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-primary"
            >
              Close
            </button>
          </header>

          <div
            ref={listRef}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3"
          >
            <div className="rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 text-sm leading-relaxed text-stone-700 shadow-sm ring-1 ring-stone-200/80">
              {welcome}
            </div>

            {turns.length === 0 && suggested.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Suggested questions
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggested.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={loading}
                      onClick={() => void ask(item.title)}
                      className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-left text-xs font-medium text-stone-800 outline-none hover:border-primary/40 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {turns.map((turn) => (
              <div
                key={turn.id}
                className={
                  turn.role === "user"
                    ? "ml-8 rounded-2xl rounded-tr-md bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-white"
                    : "mr-4 rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 text-sm leading-relaxed text-stone-800 shadow-sm ring-1 ring-stone-200/80"
                }
              >
                <p className="whitespace-pre-wrap">{turn.content}</p>
                {turn.role === "assistant" && turn.links && turn.links.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {turn.links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-800 outline-none hover:bg-stone-200 focus-visible:ring-2 focus-visible:ring-primary"
                        onClick={() => setOpen(false)}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}

            {loading ? (
              <p className="text-xs font-medium text-stone-500">Thinking…</p>
            ) : null}

            {error ? (
              <p role="alert" className="text-xs font-medium text-red-700">
                {error}
              </p>
            ) : null}

            {turns.length > 0 && suggested.length > 0 && !loading ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {suggested.slice(0, 3).map((item) => (
                  <button
                    key={`follow-${item.id}`}
                    type="button"
                    onClick={() => void ask(item.title)}
                    className="rounded-full border border-dashed border-stone-300 bg-transparent px-2.5 py-1 text-left text-[0.7rem] font-medium text-stone-600 outline-none hover:border-primary/50 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <form
            onSubmit={handleSubmit}
            className="border-t border-stone-200 bg-white p-3"
          >
            <label className="sr-only" htmlFor={`${panelId}-input`}>
              Ask a product question
            </label>
            <div className="flex gap-2">
              <input
                id={`${panelId}-input`}
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask in English, हिंदी, or मराठी…"
                maxLength={1000}
                disabled={loading}
                className={`${inputClass} flex-1`}
              />
              <button
                type="submit"
                disabled={loading || !draft.trim()}
                className={`${primaryButtonClass} px-4`}
              >
                Ask
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={[
          "pointer-events-auto shadow-lg shadow-stone-900/15",
          open ? secondaryButtonClass : primaryButtonClass,
          "px-4",
        ].join(" ")}
      >
        {open ? "Hide help" : "Need help?"}
      </button>
    </div>
  );
}
