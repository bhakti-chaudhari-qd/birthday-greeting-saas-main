"use client";

import { LandingNav } from "./landing-nav";
import { getLandingDict } from "@/lib/i18n/dictionaries/landing";
import { useLocale } from "@/lib/i18n/use-locale";

export function LandingContent() {
  const t = getLandingDict(useLocale());

  return (
    <>
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
              <p className="brand-signal">{t.hero.brandSignal}</p>
              <h1 id="hero-heading">{t.hero.heading}</h1>
              <p className="hero-subtitle">{t.hero.subtitle}</p>
              <div className="hero-actions">
                <a className="btn btn-primary" href="/register">
                  {t.hero.getStarted}
                </a>
                <a className="btn btn-secondary" href="#contact">
                  {t.hero.contactUs}
                </a>
              </div>
            </div>

            <div className="hero-visual" aria-hidden="true">
              <div className="pdf-mockup hero-pdf">
                <div className="pdf-toolbar">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="pdf-filename">{t.hero.filename}</span>
                </div>
                <div className="pdf-page birthday-page">
                  <div className="birthday-card">
                    <p className="card-eyebrow">{t.hero.cardEyebrow}</p>
                    <p className="card-name">{t.hero.cardName}</p>
                    <p className="card-headline">{t.hero.cardHeadline}</p>
                    <p className="card-body">{t.hero.cardBody}</p>
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
            <h2>{t.whatItDoes.heading}</h2>
            <p className="section-lead">{t.whatItDoes.lead}</p>

            <ol className="flow" aria-label="Product flow">
              <li>
                <span className="flow-label">{t.whatItDoes.flowTemplate}</span>
              </li>
              <li className="flow-arrow" aria-hidden="true"></li>
              <li>
                <span className="flow-label">{t.whatItDoes.flowVariables}</span>
              </li>
              <li className="flow-arrow" aria-hidden="true"></li>
              <li>
                <span className="flow-label">{t.whatItDoes.flowRecipientData}</span>
              </li>
              <li className="flow-arrow" aria-hidden="true"></li>
              <li>
                <span className="flow-label">{t.whatItDoes.flowPersonalizedPdf}</span>
              </li>
            </ol>
          </div>
        </section>

        {/* Features */}
        <section className="section features" id="features">
          <div className="container">
            <div className="section-header">
              <h2>{t.features.heading}</h2>
              <p className="section-lead">{t.features.lead}</p>
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
                <h3>{t.features.items[0]!.title}</h3>
                <p>{t.features.items[0]!.body}</p>
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
                <h3>{t.features.items[1]!.title}</h3>
                <p>{t.features.items[1]!.body}</p>
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
                <h3>{t.features.items[2]!.title}</h3>
                <p>
                  {t.features.dynamicVariablesPrefix}
                  <code>{"{{name}}"}</code>
                  {t.features.dynamicVariablesJoiner}
                  <code>{"{{mobile}}"}</code>
                  {t.features.dynamicVariablesSuffix}
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
                <h3>{t.features.items[3]!.title}</h3>
                <p>{t.features.items[3]!.body}</p>
              </article>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="section how" id="how-it-works">
          <div className="container">
            <div className="section-header">
              <h2>{t.howItWorks.heading}</h2>
              <p className="section-lead">{t.howItWorks.lead}</p>
            </div>

            <div className="steps">
              <article className="step">
                <span className="step-num">01</span>
                <h3>{t.howItWorks.steps[0]!.title}</h3>
                <p>{t.howItWorks.steps[0]!.body}</p>
              </article>
              <article className="step">
                <span className="step-num">02</span>
                <h3>{t.howItWorks.steps[1]!.title}</h3>
                <p>{t.howItWorks.steps[1]!.body}</p>
              </article>
              <article className="step">
                <span className="step-num">03</span>
                <h3>{t.howItWorks.steps[2]!.title}</h3>
                <p>
                  {t.howItWorks.personalizeStepPrefix}
                  <code>{"{{name}}"}</code>
                  {t.howItWorks.personalizeStepSuffix}
                </p>
              </article>
              <article className="step">
                <span className="step-num">04</span>
                <h3>{t.howItWorks.steps[3]!.title}</h3>
                <p>{t.howItWorks.steps[3]!.body}</p>
              </article>
            </div>
          </div>
        </section>

        {/* Product Preview */}
        <section className="section preview" id="preview">
          <div className="container">
            <div className="section-header">
              <h2>{t.preview.heading}</h2>
              <p className="section-lead">{t.preview.lead}</p>
            </div>

            <div className="preview-grid">
              <figure className="preview-card">
                <div className="product-shot editor-shot" aria-hidden="true">
                  <div className="shot-chrome">
                    <span></span>
                    <span></span>
                    <span></span>
                    <em>{t.preview.editorChrome}</em>
                  </div>
                  <div className="shot-body editor-body">
                    <aside className="editor-rail">
                      <div className="rail-item active">{t.preview.editorRailText}</div>
                      <div className="rail-item">{t.preview.editorRailVariables}</div>
                      <div className="rail-item">{t.preview.editorRailLayers}</div>
                    </aside>
                    <div className="editor-canvas">
                      <div className="canvas-page">
                        <div className="tb tb-1">{t.preview.editorCanvasHeadline}</div>
                        <div className="tb tb-2 selected">{"{{name}}"}</div>
                        <div className="tb tb-3">{t.preview.editorCanvasWarmWishes}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <figcaption>{t.preview.editorCaption}</figcaption>
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
                    <em>{t.preview.variablesChrome}</em>
                  </div>
                  <div className="shot-body variables-body">
                    <div className="var-list">
                      <div className="var-chip highlight">{"{{name}}"}</div>
                      <div className="var-chip">{"{{mobile}}"}</div>
                      <div className="var-chip">{"{{date}}"}</div>
                    </div>
                    <div className="var-preview">
                      <p className="muted-line">
                        {t.preview.variablesDear} <mark>{"{{name}}"}</mark>,
                      </p>
                      <p className="muted-line">
                        {t.preview.variablesContact} <mark>{"{{mobile}}"}</mark>
                      </p>
                      <p className="resolved">{t.preview.variablesResolvedDear}</p>
                      <p className="resolved">{t.preview.variablesResolvedContact}</p>
                    </div>
                  </div>
                </div>
                <figcaption>{t.preview.variablesCaption}</figcaption>
              </figure>

              <figure className="preview-card">
                <div className="product-shot result-shot" aria-hidden="true">
                  <div className="shot-chrome">
                    <span></span>
                    <span></span>
                    <span></span>
                    <em>{t.preview.resultChrome}</em>
                  </div>
                  <div className="shot-body result-body">
                    <div className="mini-pdf">
                      <p className="mini-eyebrow">{t.preview.resultEyebrow}</p>
                      <p className="mini-name">{t.preview.resultName}</p>
                      <p className="mini-copy">{t.preview.resultBody}</p>
                      <div className="mini-footer">{t.preview.resultFooter}</div>
                    </div>
                  </div>
                </div>
                <figcaption>{t.preview.resultCaption}</figcaption>
              </figure>
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="section use-cases" id="use-cases">
          <div className="container">
            <div className="section-header">
              <h2>{t.useCases.heading}</h2>
              <p className="section-lead">{t.useCases.lead}</p>
            </div>

            <div className="use-grid">
              {t.useCases.items.map((item) => (
                <article className="use-card" key={item}>
                  {item}
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="section cta" id="get-started">
          <div className="container cta-panel">
            <h2>{t.cta.heading}</h2>
            <p>{t.cta.body}</p>
            <a className="btn btn-primary" href="/register">
              {t.cta.getStarted}
            </a>
          </div>
        </section>

        {/* Contact */}
        <section className="section contact" id="contact">
          <div className="container narrow">
            <h2>{t.contact.heading}</h2>
            <p className="section-lead">{t.contact.lead}</p>
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
            <a href="#features">{t.nav.features}</a>
            <a href="#how-it-works">{t.nav.howItWorks}</a>
            <a href="#use-cases">{t.nav.useCases}</a>
            <a href="#contact">{t.nav.contact}</a>
          </nav>
          <p className="copyright">{t.footer.copyright}</p>
        </div>
      </footer>
    </>
  );
}
