import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Birthday Wishs",
  description:
    "How Birthday Wishs collects, uses, shares and protects personal information.",
};

// Same bounded cache TTL as the landing page (see src/app/page.tsx).
export const revalidate = 300;

const LAST_UPDATED = "12 October 2026";
const CONTACT_PHONE = "+91 80555 24206";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-stone-700">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Link href="/" className="text-sm font-medium text-stone-600 hover:underline">
        ← Birthday Wishs
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-stone-900">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-stone-500">Last updated: {LAST_UPDATED}</p>

      <Section title="Who we are">
        <p>
          Birthday Wishs (birthdaywishs.in) is a service operated by Quickly Design
          that lets businesses send birthday, anniversary and other greetings to
          their own contacts by WhatsApp, SMS and email. This policy explains what
          personal information we handle and why.
        </p>
      </Section>

      <Section title="Information we collect">
        <p>
          <strong>Account information.</strong> When a business registers we collect
          the organization name, the owner&apos;s name, email address, mobile number
          and a password. Passwords are stored only in hashed form.
        </p>
        <p>
          <strong>Contact lists uploaded by our customers.</strong> Businesses add
          the people they want to greet. This can include names, mobile numbers,
          email addresses, dates such as birthdays and anniversaries, and any
          custom details the business chooses to record.
        </p>
        <p>
          <strong>Messages and delivery records.</strong> We store the greeting
          templates a business creates, the messages sent through the service, and
          their status (for example submitted, delivered or failed).
        </p>
        <p>
          <strong>Billing information.</strong> Payments are processed by Razorpay.
          We keep a record of plans and payments but do not store card or bank
          details.
        </p>
        <p>
          <strong>Technical information.</strong> We use cookies that are necessary
          to keep you signed in and to remember your language, and we keep server
          logs needed to run and secure the service.
        </p>
      </Section>

      <Section title="How we use information">
        <ul className="list-disc space-y-1 pl-5">
          <li>To provide the service, including sending the greetings a business schedules or sends.</li>
          <li>To show businesses the status of their messages and help resolve failures.</li>
          <li>To manage accounts, plans, billing and support requests.</li>
          <li>To protect the service against misuse and to meet legal obligations.</li>
        </ul>
        <p>
          We do not sell personal information, and we do not use the contact lists
          uploaded by our customers for our own marketing.
        </p>
      </Section>

      <Section title="Our role for uploaded contacts">
        <p>
          Each business that uses Birthday Wishs decides whom to message and is
          responsible for having permission to contact those people. We handle
          their contact lists only to deliver the service on their behalf. If you
          received a greeting and want it to stop, please contact the business that
          sent it; you can also contact us and we will pass the request on.
        </p>
      </Section>

      <Section title="Who we share information with">
        <p>We share information only as needed to operate the service:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Messaging providers</strong> — WhatsApp (Meta), SMS gateways and
            our email delivery provider receive the recipient&apos;s number or email
            address and the message content so that it can be delivered.
          </li>
          <li>
            <strong>Payment provider</strong> — Razorpay, to process payments.
          </li>
          <li>
            <strong>Hosting and storage providers</strong> — to run the service and
            store generated documents.
          </li>
          <li>
            <strong>AI drafting provider</strong> — when a business uses the
            optional AI writing feature, the text it submits is sent to that
            provider to produce a draft.
          </li>
          <li>
            <strong>Authorities</strong> — where the law requires it.
          </li>
        </ul>
      </Section>

      <Section title="How long we keep information">
        <p>
          We keep account information, contact lists and message records for as
          long as the business&apos;s account is active. Generated documents are
          kept for a limited period and then removed. When an account is deleted,
          its contacts, templates and message history are deleted with it, except
          for records we must keep for legal or accounting reasons.
        </p>
      </Section>

      <Section title="Security">
        <p>
          Access to each business&apos;s data is restricted to that business&apos;s
          authorized users. Connections to the service are encrypted, passwords are
          hashed, and the credentials businesses save for their own messaging
          gateways are stored encrypted. No system is completely secure, but we
          work to protect the information we hold.
        </p>
      </Section>

      <Section title="Your choices and rights">
        <p>
          Account holders can view, correct, export and delete their contacts from
          within the service, and can ask us to delete their account. Anyone can
          ask us what information we hold about them and request its correction or
          deletion using the contact details below. We may need to verify your
          identity before acting on a request.
        </p>
      </Section>

      <Section title="Children">
        <p>
          The service is intended for businesses and is not directed at children.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          We may update this policy from time to time. The date at the top of this
          page shows when it was last changed.
        </p>
      </Section>

      <Section title="Contact us">
        <p>
          For any question or request about this policy or your information, call
          us on <a className="font-medium underline" href="tel:+918055524206">{CONTACT_PHONE}</a>{" "}
          or reach us through{" "}
          <Link className="font-medium underline" href="/#contact">
            the contact section of our website
          </Link>
          .
        </p>
      </Section>
    </main>
  );
}
