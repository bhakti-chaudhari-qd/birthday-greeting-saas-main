"use client";

import { useCallback, useEffect, useState } from "react";

import { InlineAlert } from "@/components/ui/feedback";
import {
  PageHeader,
  PageShell,
  Panel,
  compactSecondaryButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import type { Locale } from "@/lib/i18n/constants";
import { useLocale } from "@/lib/i18n/use-locale";

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

type Labels = {
  title: string;
  description: string;
  createTitle: string;
  namePlaceholder: string;
  create: string;
  creating: string;
  newKeyTitle: string;
  newKeyWarning: string;
  copy: string;
  copied: string;
  done: string;
  keysTitle: string;
  noKeys: string;
  name: string;
  key: string;
  created: string;
  lastUsed: string;
  never: string;
  status: string;
  active: string;
  revoked: string;
  revoke: string;
  revokeConfirm: (name: string) => string;
  revokedToast: string;
  failedToLoad: string;
  failedToCreate: string;
  failedToRevoke: string;
  usageTitle: string;
  usageIntro: string;
  usageEndpoints: string;
  usageReadHint: string;
  usageWrite: string;
  usageWriteHint: string;
  usageLimit: string;
};

const LABELS: Record<Locale, Labels> = {
  en: {
    title: "API Keys",
    description:
      "Let another app, such as your OMS, sync contacts with this account. A key can only read and update each contact's name, date of birth, phone number and email - nothing else.",
    createTitle: "Create a key",
    namePlaceholder: "Name, e.g. CRM integration",
    create: "Create key",
    creating: "Creating…",
    newKeyTitle: "Your new API key",
    newKeyWarning:
      "Copy this key now and store it safely. It will not be shown again.",
    copy: "Copy",
    copied: "API key copied",
    done: "I have saved it",
    keysTitle: "Your keys",
    noKeys: "No API keys yet.",
    name: "Name",
    key: "Key",
    created: "Created",
    lastUsed: "Last used",
    never: "Never",
    status: "Status",
    active: "Active",
    revoked: "Revoked",
    revoke: "Revoke",
    revokeConfirm: (name) =>
      `Revoke "${name}"? Any software using this key will stop working immediately.`,
    revokedToast: "API key revoked",
    failedToLoad: "Could not load API keys.",
    failedToCreate: "Could not create the API key.",
    failedToRevoke: "Could not revoke the API key.",
    usageTitle: "How to use a key",
    usageIntro:
      "Send the key in the Authorization header. Requests and responses are JSON, and dates use YYYY-MM-DD.",
    usageEndpoints: "Read contacts",
    usageReadHint:
      "Pages of 50 (limit up to 100). Add updatedSince=<ISO time> to get only contacts changed since your last sync, or mobile=<number> to look one up.",
    usageWrite: "Add or update contacts",
    usageWriteHint:
      "Up to 100 per request, matched by mobile number. Leave out email or dob to keep the saved value; send null to clear it.",
    usageLimit:
      "Each key can make up to 120 requests per minute. New contacts count toward your plan's contact limit.",
  },
  hi: {
    title: "API कीज़",
    description:
      "किसी दूसरे ऐप, जैसे आपके OMS, को इस अकाउंट के साथ कॉन्टैक्ट सिंक करने दें। एक की से सिर्फ़ हर कॉन्टैक्ट का नाम, जन्मतिथि, फ़ोन नंबर और ईमेल पढ़ा और अपडेट किया जा सकता है - इसके अलावा कुछ नहीं।",
    createTitle: "नई की बनाएं",
    namePlaceholder: "नाम, जैसे CRM इंटीग्रेशन",
    create: "की बनाएं",
    creating: "बन रही है…",
    newKeyTitle: "आपकी नई API की",
    newKeyWarning:
      "इस की को अभी कॉपी करके सुरक्षित रखें। यह दोबारा नहीं दिखाई जाएगी।",
    copy: "कॉपी करें",
    copied: "API की कॉपी हो गई",
    done: "मैंने सेव कर ली",
    keysTitle: "आपकी कीज़",
    noKeys: "अभी कोई API की नहीं है।",
    name: "नाम",
    key: "की",
    created: "बनाई गई",
    lastUsed: "आख़िरी इस्तेमाल",
    never: "कभी नहीं",
    status: "स्थिति",
    active: "चालू",
    revoked: "रद्द",
    revoke: "रद्द करें",
    revokeConfirm: (name) =>
      `"${name}" को रद्द करें? इस की का इस्तेमाल करने वाला सॉफ़्टवेयर तुरंत काम करना बंद कर देगा।`,
    revokedToast: "API की रद्द हो गई",
    failedToLoad: "API कीज़ लोड नहीं हो सकीं।",
    failedToCreate: "API की नहीं बन सकी।",
    failedToRevoke: "API की रद्द नहीं हो सकी।",
    usageTitle: "की का इस्तेमाल कैसे करें",
    usageIntro:
      "Authorization हेडर में की भेजें। रिक्वेस्ट और रिस्पॉन्स JSON में होते हैं, और तारीखें YYYY-MM-DD फ़ॉर्मैट में।",
    usageEndpoints: "कॉन्टैक्ट पढ़ें",
    usageReadHint:
      "हर पेज में 50 (limit से 100 तक)। पिछले सिंक के बाद बदले कॉन्टैक्ट के लिए updatedSince=<ISO समय> जोड़ें, या किसी एक को ढूंढने के लिए mobile=<नंबर>।",
    usageWrite: "कॉन्टैक्ट जोड़ें या अपडेट करें",
    usageWriteHint:
      "एक रिक्वेस्ट में 100 तक, मोबाइल नंबर से मिलाए जाते हैं। सेव की गई वैल्यू रखने के लिए email या dob न भेजें; हटाने के लिए null भेजें।",
    usageLimit:
      "हर की से एक मिनट में 120 रिक्वेस्ट की जा सकती हैं। नए कॉन्टैक्ट आपके प्लान की कॉन्टैक्ट सीमा में गिने जाते हैं।",
  },
  mr: {
    title: "API कीज",
    description:
      "दुसऱ्या ॲपला, जसे तुमचे OMS, या खात्यासोबत कॉन्टॅक्ट सिंक करू द्या. एका कीने फक्त प्रत्येक कॉन्टॅक्टचे नाव, जन्मतारीख, फोन नंबर आणि ईमेल वाचता आणि अपडेट करता येतात - याशिवाय काहीही नाही.",
    createTitle: "नवीन की तयार करा",
    namePlaceholder: "नाव, उदा. CRM इंटिग्रेशन",
    create: "की तयार करा",
    creating: "तयार होत आहे…",
    newKeyTitle: "तुमची नवीन API की",
    newKeyWarning:
      "ही की आत्ताच कॉपी करून सुरक्षित ठेवा. ती पुन्हा दाखवली जाणार नाही.",
    copy: "कॉपी करा",
    copied: "API की कॉपी झाली",
    done: "मी सेव्ह केली",
    keysTitle: "तुमच्या कीज",
    noKeys: "अजून कोणतीही API की नाही.",
    name: "नाव",
    key: "की",
    created: "तयार केली",
    lastUsed: "शेवटचा वापर",
    never: "कधीच नाही",
    status: "स्थिती",
    active: "सक्रिय",
    revoked: "रद्द",
    revoke: "रद्द करा",
    revokeConfirm: (name) =>
      `"${name}" रद्द करायची? ही की वापरणारे सॉफ्टवेअर लगेच काम करणे थांबवेल.`,
    revokedToast: "API की रद्द झाली",
    failedToLoad: "API कीज लोड होऊ शकल्या नाहीत.",
    failedToCreate: "API की तयार होऊ शकली नाही.",
    failedToRevoke: "API की रद्द होऊ शकली नाही.",
    usageTitle: "की कशी वापरायची",
    usageIntro:
      "Authorization हेडरमध्ये की पाठवा. रिक्वेस्ट आणि रिस्पॉन्स JSON मध्ये असतात, आणि तारखा YYYY-MM-DD फॉरमॅटमध्ये.",
    usageEndpoints: "कॉन्टॅक्ट वाचा",
    usageReadHint:
      "प्रत्येक पेजमध्ये 50 (limit ने 100 पर्यंत). मागील सिंकनंतर बदललेल्या कॉन्टॅक्टसाठी updatedSince=<ISO वेळ> जोडा, किंवा एक शोधण्यासाठी mobile=<नंबर>.",
    usageWrite: "कॉन्टॅक्ट जोडा किंवा अपडेट करा",
    usageWriteHint:
      "एका रिक्वेस्टमध्ये 100 पर्यंत, मोबाइल नंबरने जुळवले जातात. सेव्ह केलेली व्हॅल्यू ठेवण्यासाठी email किंवा dob पाठवू नका; काढण्यासाठी null पाठवा.",
    usageLimit:
      "प्रत्येक कीने एका मिनिटात 120 रिक्वेस्ट करता येतात. नवीन कॉन्टॅक्ट तुमच्या प्लॅनच्या कॉन्टॅक्ट मर्यादेत मोजले जातात.",
  },
};

const INTEGRATION_CONTACTS_PATH = "/api/v1/integrations/contacts";

const UPSERT_EXAMPLE_BODY = `{
  "contacts": [
    {
      "name": "Asha Patel",
      "mobile": "9876543210",
      "email": "asha@example.com",
      "dob": "1990-08-15"
    }
  ]
}`;

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Owner page for creating, viewing, and revoking organization API keys. */
export function ApiKeySettings() {
  const labels = LABELS[useLocale()];
  const { showToast } = useToast();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("https://your-domain");

  const fetchKeys = useCallback(async (): Promise<ApiKeyRow[] | null> => {
    try {
      const response = await fetch("/api/v1/api-keys");
      const body = await response.json();

      if (!response.ok) {
        setError(body.error?.message ?? labels.failedToLoad);
        return null;
      }

      return body.data as ApiKeyRow[];
    } catch {
      setError(labels.failedToLoad);
      return null;
    }
  }, [labels.failedToLoad]);

  async function reload() {
    const rows = await fetchKeys();
    if (rows) {
      setKeys(rows);
    }
  }

  useEffect(() => {
    async function load() {
      const rows = await fetchKeys();
      if (rows) {
        setKeys(rows);
      }
      setOrigin(window.location.origin);
      setLoaded(true);
    }

    void load();
  }, [fetchKeys]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error?.message ?? labels.failedToCreate);
        return;
      }

      setNewKey(body.data.key as string);
      setName("");
      await reload();
    } catch {
      setError(labels.failedToCreate);
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(row: ApiKeyRow) {
    if (!window.confirm(labels.revokeConfirm(row.name))) {
      return;
    }

    setError(null);

    try {
      const response = await fetch(`/api/v1/api-keys/${row.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = await response.json();
        setError(body.error?.message ?? labels.failedToRevoke);
        return;
      }

      showToast(labels.revokedToast);
      await reload();
    } catch {
      setError(labels.failedToRevoke);
    }
  }

  async function handleCopy() {
    if (!newKey) {
      return;
    }

    await navigator.clipboard.writeText(newKey);
    showToast(labels.copied);
  }

  return (
    <PageShell>
      <PageHeader title={labels.title} description={labels.description} />

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      {newKey ? (
        <Panel className="p-5">
          <h2 className="text-sm font-semibold text-stone-900">
            {labels.newKeyTitle}
          </h2>
          <div className="mt-3">
            <InlineAlert tone="warning">{labels.newKeyWarning}</InlineAlert>
          </div>
          <code className="mt-3 block break-all rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900">
            {newKey}
          </code>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => void handleCopy()}
            >
              {labels.copy}
            </button>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setNewKey(null)}
            >
              {labels.done}
            </button>
          </div>
        </Panel>
      ) : null}

      <Panel className="p-5">
        <h2 className="text-sm font-semibold text-stone-900">
          {labels.createTitle}
        </h2>
        <form
          className="mt-3 flex max-w-xl flex-col gap-2 sm:flex-row"
          onSubmit={(event) => void handleCreate(event)}
        >
          <input
            type="text"
            className={inputClass}
            placeholder={labels.namePlaceholder}
            aria-label={labels.name}
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button
            type="submit"
            className={`shrink-0 ${primaryButtonClass}`}
            disabled={creating || !name.trim()}
          >
            {creating ? labels.creating : labels.create}
          </button>
        </form>
      </Panel>

      <Panel className="p-5">
        <h2 className="text-sm font-semibold text-stone-900">
          {labels.keysTitle}
        </h2>
        {loaded && keys.length === 0 ? (
          <p className="mt-3 text-sm text-stone-600">{labels.noKeys}</p>
        ) : null}
        {keys.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">{labels.name}</th>
                  <th className="py-2 pr-4 font-medium">{labels.key}</th>
                  <th className="py-2 pr-4 font-medium">{labels.created}</th>
                  <th className="py-2 pr-4 font-medium">{labels.lastUsed}</th>
                  <th className="py-2 pr-4 font-medium">{labels.status}</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {keys.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2.5 pr-4 font-medium text-stone-900">
                      {row.name}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-stone-700">
                      {row.keyPrefix}…
                    </td>
                    <td className="py-2.5 pr-4 text-stone-700">
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td className="py-2.5 pr-4 text-stone-700">
                      {row.lastUsedAt
                        ? formatDateTime(row.lastUsedAt)
                        : labels.never}
                    </td>
                    <td className="py-2.5 pr-4 text-stone-700">
                      {row.revokedAt ? labels.revoked : labels.active}
                    </td>
                    <td className="py-2.5 text-right">
                      {row.revokedAt ? null : (
                        <button
                          type="button"
                          className={compactSecondaryButtonClass}
                          onClick={() => void handleRevoke(row)}
                        >
                          {labels.revoke}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>

      <Panel className="p-5">
        <h2 className="text-sm font-semibold text-stone-900">
          {labels.usageTitle}
        </h2>
        <p className="mt-1 text-sm text-stone-600">{labels.usageIntro}</p>
        <h3 className="mt-4 text-sm font-medium text-stone-800">
          {labels.usageEndpoints}
        </h3>
        <p className="mt-1 text-xs text-stone-600">{labels.usageReadHint}</p>
        <pre className="mt-2 overflow-x-auto rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs leading-relaxed text-stone-900">
          {`curl "${origin}${INTEGRATION_CONTACTS_PATH}?page=1&limit=50" \\\n  -H "Authorization: Bearer bw_live_..."`}
        </pre>
        <h3 className="mt-4 text-sm font-medium text-stone-800">
          {labels.usageWrite}
        </h3>
        <p className="mt-1 text-xs text-stone-600">{labels.usageWriteHint}</p>
        <pre className="mt-2 overflow-x-auto rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs leading-relaxed text-stone-900">
          {`curl -X POST ${origin}${INTEGRATION_CONTACTS_PATH} \\\n  -H "Authorization: Bearer bw_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '${UPSERT_EXAMPLE_BODY}'`}
        </pre>
        <p className="mt-4 text-xs text-stone-500">{labels.usageLimit}</p>
      </Panel>
    </PageShell>
  );
}
