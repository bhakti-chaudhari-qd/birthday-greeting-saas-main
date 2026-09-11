import type { Metadata } from "next";

import { LandingNav } from "./landing-nav";
import "./landing.css";

export const metadata: Metadata = {
  title: "Birthday Greeting — Personalized Documents Made Simple",
  description:
    "Design reusable greeting templates, add dynamic variables, and generate personalized PDFs for every recipient.",
};

// Static page, so Next sends a long shared-cache TTL by default - the VPS's
// nginx has no deploy-aware invalidation, so an unbounded TTL means a stale
// build could get stuck in its cache indefinitely. Bound it here instead.
export const revalidate = 300;

export default function Home() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin=""
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Sora:wght@500;600;700&display=swap"
        rel="stylesheet"
      />

      <header className="site-header" id="top">
        <div className="container nav">
          <a className="brand" href="#top" aria-label="Birthday Greeting home">
            <span className="brand-mark" aria-hidden="true"></span>
            <span className="brand-name">Birthday Greeting</span>
          </a>

          <LandingNav />
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="hero" aria-labelledby="hero-heading">
          <div className="hero-bg" aria-hidden="true"></div>
          <div className="container hero-grid">
            <div className="hero-copy">
              <p className="brand-signal">Birthday Greeting</p>
              <h1 id="hero-heading">
                Create Personalized Greetings. Effortlessly.
              </h1>
              <p className="hero-subtitle">
                Design beautiful greeting templates once, personalize them
                with dynamic information, and generate professional PDFs for
                every recipient.
              </p>
              <div className="hero-actions">
                <a className="btn btn-primary" href="/register">
                  Get Started
                </a>
                <a className="btn btn-secondary" href="#contact">
                  Contact Us
                </a>
              </div>
            </div>

            <div className="hero-visual" aria-hidden="true">
              <div className="pdf-mockup hero-pdf">
                <div className="pdf-toolbar">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="pdf-filename">birthday-greeting.pdf</span>
                </div>
                <div className="pdf-page birthday-page">
                  <div className="birthday-card">
                    <p className="card-eyebrow">A special note for</p>
                    <p className="card-name">Priya Sharma</p>
                    <p className="card-headline">Happy Birthday</p>
                    <p className="card-body">
                      Wishing you a wonderful year ahead. With warm regards
                      from the team.
                    </p>
                    <div className="card-meta">
                      <span>{"{{mobile}}"} → +91 ***** *****</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* What It Does */}
        <section className="section what-it-does" id="what-it-does">
          <div className="container narrow">
            <h2>Personalized documents without the repetitive work.</h2>
            <p className="section-lead">
              Create a reusable PDF template, add text boxes and dynamic
              variables, provide recipient information, and generate a
              personalized PDF — without rebuilding the design each time.
            </p>

            <ol className="flow" aria-label="Product flow">
              <li>
                <span className="flow-label">Template</span>
              </li>
              <li className="flow-arrow" aria-hidden="true"></li>
              <li>
                <span className="flow-label">Variables</span>
              </li>
              <li className="flow-arrow" aria-hidden="true"></li>
              <li>
                <span className="flow-label">Recipient Data</span>
              </li>
              <li className="flow-arrow" aria-hidden="true"></li>
              <li>
                <span className="flow-label">Personalized PDF</span>
              </li>
            </ol>
          </div>
        </section>

        {/* Features */}
        <section className="section features" id="features">
          <div className="container">
            <div className="section-header">
              <h2>Everything you need to personalize documents</h2>
              <p className="section-lead">
                A focused toolkit for designing templates and generating
                recipient-ready PDFs.
              </p>
            </div>

            <div className="feature-grid">
              <article className="feature-card">
                <div className="icon-wrap" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                  >
                    <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
                    <path d="M14 3v5h5" />
                    <path d="M9 13h6M9 17h4" />
                  </svg>
                </div>
                <h3>Design Templates</h3>
                <p>Create reusable branded PDF templates.</p>
              </article>

              <article className="feature-card">
                <div className="icon-wrap" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                  >
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <path d="M8 9h5v4H8z" />
                    <path d="M15 15h3M15 11h3" />
                  </svg>
                </div>
                <h3>Visual Editor</h3>
                <p>Add, move and resize text boxes.</p>
              </article>

              <article className="feature-card">
                <div className="icon-wrap" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                  >
                    <path d="M8 7h3a3 3 0 0 1 0 6H8v4" />
                    <path d="M16 7v10" />
                    <path d="M14 17h4" />
                  </svg>
                </div>
                <h3>Dynamic Variables</h3>
                <p>
                  Use variables such as <code>{"{{name}}"}</code> and{" "}
                  <code>{"{{mobile}}"}</code>.
                </p>
              </article>

              <article className="feature-card">
                <div className="icon-wrap" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                  >
                    <path d="M12 3v12" />
                    <path d="M8 11l4 4 4-4" />
                    <path d="M5 19h14" />
                  </svg>
                </div>
                <h3>Personalized PDFs</h3>
                <p>Generate a personalized PDF for each recipient.</p>
              </article>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="section how" id="how-it-works">
          <div className="container">
            <div className="section-header">
              <h2>How it works</h2>
              <p className="section-lead">
                Four clear steps from blank template to finished document.
              </p>
            </div>

            <div className="steps">
              <article className="step">
                <span className="step-num">01</span>
                <h3>Create</h3>
                <p>Upload your blank PDF template.</p>
              </article>
              <article className="step">
                <span className="step-num">02</span>
                <h3>Design</h3>
                <p>Add and position your text boxes.</p>
              </article>
              <article className="step">
                <span className="step-num">03</span>
                <h3>Personalize</h3>
                <p>
                  Add variables such as <code>{"{{name}}"}</code>.
                </p>
              </article>
              <article className="step">
                <span className="step-num">04</span>
                <h3>Generate</h3>
                <p>Provide recipient data and generate the final PDF.</p>
              </article>
            </div>
          </div>
        </section>

        {/* Product Preview */}
        <section className="section preview" id="preview">
          <div className="container">
            <div className="section-header">
              <h2>See the product</h2>
              <p className="section-lead">
                From editor to variables to the finished personalized PDF.
              </p>
            </div>

            <div className="preview-grid">
              <figure className="preview-card">
                <div className="product-shot editor-shot" aria-hidden="true">
                  <div className="shot-chrome">
                    <span></span>
                    <span></span>
                    <span></span>
                    <em>Template Editor</em>
                  </div>
                  <div className="shot-body editor-body">
                    <aside className="editor-rail">
                      <div className="rail-item active">Text</div>
                      <div className="rail-item">Variables</div>
                      <div className="rail-item">Layers</div>
                    </aside>
                    <div className="editor-canvas">
                      <div className="canvas-page">
                        <div className="tb tb-1">Happy Birthday</div>
                        <div className="tb tb-2 selected">{"{{name}}"}</div>
                        <div className="tb tb-3">With warm wishes</div>
                      </div>
                    </div>
                  </div>
                </div>
                <figcaption>
                  Template editor — place and resize text boxes on your PDF.
                </figcaption>
              </figure>

              <figure className="preview-card">
                <div
                  className="product-shot variables-shot"
                  aria-hidden="true"
                >
                  <div className="shot-chrome">
                    <span></span>
                    <span></span>
                    <span></span>
                    <em>Variables</em>
                  </div>
                  <div className="shot-body variables-body">
                    <div className="var-list">
                      <div className="var-chip highlight">{"{{name}}"}</div>
                      <div className="var-chip">{"{{mobile}}"}</div>
                      <div className="var-chip">{"{{date}}"}</div>
                    </div>
                    <div className="var-preview">
                      <p className="muted-line">
                        Dear <mark>{"{{name}}"}</mark>,
                      </p>
                      <p className="muted-line">
                        Contact: <mark>{"{{mobile}}"}</mark>
                      </p>
                      <p className="resolved">→ Dear Ananya Mehta,</p>
                      <p className="resolved">→ Contact: +91 91234 56789</p>
                    </div>
                  </div>
                </div>
                <figcaption>
                  Dynamic variables — highlight placeholders and map
                  recipient fields.
                </figcaption>
              </figure>

              <figure className="preview-card">
                <div className="product-shot result-shot" aria-hidden="true">
                  <div className="shot-chrome">
                    <span></span>
                    <span></span>
                    <span></span>
                    <em>Generated PDF</em>
                  </div>
                  <div className="shot-body result-body">
                    <div className="mini-pdf">
                      <p className="mini-eyebrow">
                        Certificate of Appreciation
                      </p>
                      <p className="mini-name">Rohan Patel</p>
                      <p className="mini-copy">
                        In recognition of outstanding contribution and
                        dedication.
                      </p>
                      <div className="mini-footer">
                        Generated document · Ready to download
                      </div>
                    </div>
                  </div>
                </div>
                <figcaption>
                  Personalized PDF — one finished document per recipient.
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="section use-cases" id="use-cases">
          <div className="container">
            <div className="section-header">
              <h2>Built for more than birthdays.</h2>
              <p className="section-lead">
                Use the same template workflow for greetings, recognition,
                and everyday documents.
              </p>
            </div>

            <div className="use-grid">
              <article className="use-card">Birthday Greetings</article>
              <article className="use-card">Anniversary Greetings</article>
              <article className="use-card">Certificates</article>
              <article className="use-card">Employee Recognition</article>
              <article className="use-card">Customer Communication</article>
              <article className="use-card">Events &amp; Occasions</article>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="section cta" id="get-started">
          <div className="container cta-panel">
            <h2>Create your first personalized greeting.</h2>
            <p>
              Build a reusable template and turn it into personalized
              documents in minutes.
            </p>
            <a className="btn btn-primary" href="/register">
              Get Started
            </a>
          </div>
        </section>

        {/* Contact */}
        <section className="section contact" id="contact">
          <div className="container narrow">
            <h2>Have questions? Let&apos;s talk.</h2>
            <p className="section-lead">
              Reach out by phone — we&apos;re happy to walk you through the
              product.
            </p>
            <a className="phone-link" href="tel:8055524206">
              8055524206
            </a>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="footer-brand">
            <span className="brand-mark" aria-hidden="true"></span>
            <span>Birthday Greeting</span>
          </div>
          <nav className="footer-links" aria-label="Footer">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#use-cases">Use Cases</a>
            <a href="#contact">Contact</a>
          </nav>
          <p className="copyright">© 2026 Birthday Greeting</p>
        </div>
      </footer>
    </>
  );
}
