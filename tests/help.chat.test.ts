import { afterEach, describe, expect, it, vi } from "vitest";

import { answerHelpChat } from "@/lib/help/chat";
import {
  getSuggestedHelpQuestions,
  resolveHelpArticlesForChat,
  retrieveHelpArticles,
} from "@/lib/help/knowledge";
import { detectHelpReplyLanguage } from "@/lib/help/language";
import {
  assertHelpChatAllowed,
  HelpRateLimitError,
  resetHelpRateLimits,
} from "@/lib/help/rate-limit";

describe("help knowledge", () => {
  it("exposes suggested starter questions, prioritizing setup and sending", () => {
    const questions = getSuggestedHelpQuestions(6);
    expect(questions.length).toBeGreaterThanOrEqual(4);
    expect(questions.some((q) => /configure email/i.test(q.title))).toBe(true);
    expect(questions.some((q) => /configure sms/i.test(q.title))).toBe(true);
    expect(questions.some((q) => /configure whatsapp/i.test(q.title))).toBe(
      true,
    );
    expect(questions.some((q) => /create an automation/i.test(q.title))).toBe(
      true,
    );
    expect(
      questions.some((q) => /send a message right now/i.test(q.title)),
    ).toBe(true);
    expect(questions.some((q) => /get started/i.test(q.title))).toBe(true);
  });

  it("retrieves owner vs staff article for role questions", () => {
    const articles = retrieveHelpArticles(
      "What's the difference between Owner and Staff?",
    );
    expect(articles[0]?.id).toBe("owner-vs-staff");
  });

  it("retrieves cannot-send guidance for blocked sends", () => {
    const articles = retrieveHelpArticles("why can't I send messages?");
    expect(articles[0]?.id).toBe("cannot-send");
  });

  it("matches Hindi contact keywords", () => {
    const articles = retrieveHelpArticles("संपर्क कैसे जोड़ें?");
    expect(articles.some((article) => article.id === "add-contacts")).toBe(
      true,
    );
  });

  it("grounds Hindi questions with suggested articles when needed", () => {
    const articles = resolveHelpArticlesForChat("मदद चाहिए", "hi");
    expect(articles.length).toBeGreaterThanOrEqual(1);
    expect(articles.some((article) => article.id === "get-started")).toBe(true);
  });
});

describe("help reply language", () => {
  it("detects English, Hindi, and Marathi", () => {
    expect(detectHelpReplyLanguage("How do I add contacts?")).toBe("en");
    expect(detectHelpReplyLanguage("संपर्क कैसे जोड़ें?")).toBe("hi");
    expect(detectHelpReplyLanguage("वाढदिवस ऑटोमेशन कसे काम करते?")).toBe(
      "mr",
    );
  });
});

describe("help rate limit", () => {
  afterEach(() => {
    resetHelpRateLimits();
  });

  it("blocks after the hourly cap", () => {
    for (let i = 0; i < 40; i += 1) {
      assertHelpChatAllowed("org-rate-test");
    }
    expect(() => assertHelpChatAllowed("org-rate-test")).toThrow(
      HelpRateLimitError,
    );
  });
});

describe("answerHelpChat", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.OPENAI_API_KEY;
  });

  it("falls back to curated FAQ when OpenAI is unavailable", async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await answerHelpChat({
      message: "How do birthday automations work?",
      history: [],
    });

    expect(result.provider).toBe("curated");
    expect(result.articleIds).toContain("automations");
    expect(result.answer.toLowerCase()).toMatch(/greeting|birthday|ist|category/);
    expect(
      result.links.some((link) => link.href.includes("greeting-routes")),
    ).toBe(true);
  });

  it("returns Marathi curated FAQ without OpenAI", async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await answerHelpChat({
      message: "वाढदिवस ऑटोमेशन कसे काम करते?",
      history: [],
    });

    expect(result.provider).toBe("curated");
    expect(result.articleIds).toContain("automations");
    expect(result.answer).toMatch(/Automatic Greetings|पाठवण्याचा वेळ|वाढदिवस/);
    expect(result.answer).not.toMatch(/इंग्रजीत आहे/);
  });

  it("returns Hindi curated empty guidance without OpenAI", async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await answerHelpChat({
      message: "यह पूरी तरह अनजाना विषय xyzabc है",
      history: [],
    });

    expect(result.provider).toBe("curated");
    expect(result.answer).toMatch(/सवाल|जवाब|कॉन्टैक्ट्स|बिलिंग/);
  });

  it("instructs OpenAI to reply in Hindi for Hindi questions", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        messages?: Array<{ role: string; content: string }>;
      };
      const system = body.messages?.find((message) => message.role === "system");
      expect(system?.content).toMatch(/Reply entirely in clear Hindi/i);

      return Response.json({
        choices: [
          {
            message: {
              content:
                "Automatic Greetings में जाकर प्रत्येक श्रेणी के लिए समय और टेम्पलेट सेट करें।",
            },
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await answerHelpChat(
      {
        message: "जन्मदिन ऑटोमेशन कैसे काम करता है?",
        history: [],
      },
      { organizationId: "org-1" },
    );

    expect(result.provider).toBe("openai");
    expect(result.answer).toMatch(/Automatic Greetings|टेम्पलेट/);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("uses OpenAI when the API key is set", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          choices: [
            {
              message: {
                content:
                  "Owners configure Automatic Greetings. Each category can have its own send time and template.",
              },
            },
          ],
        }),
      ),
    );

    const result = await answerHelpChat(
      {
        message: "How do birthday automations work?",
        history: [],
      },
      { organizationId: "org-1" },
    );

    expect(result.provider).toBe("openai");
    expect(result.answer).toMatch(/Automatic Greetings/i);
    expect(result.articleIds).toContain("automations");
  });
});
