import Layout from "../components/Layout.jsx";

export default function Support() {
  return (
    <Layout
      eyebrow="Support"
      title="We&apos;re here to help."
      subtitle="Reach out for account questions, product help, or guidance on how to get the most from AirSave."
      shellClassName="support-page-shell"
    >
      <section className="dashboard-columns support-layout">
        <article className="app-card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Contact form</h2>
              <p className="card-subtitle">Send a message and our team will follow up.</p>
            </div>
          </div>

          <form className="form-grid" onSubmit={(e) => e.preventDefault()}>
            <div className="field-group">
              <label className="field-label" htmlFor="supportName">
                Name
              </label>
              <input id="supportName" className="app-input" type="text" placeholder="Your full name" />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="supportEmail">
                Email
              </label>
              <input id="supportEmail" className="app-input" type="email" placeholder="you@example.com" />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="supportMessage">
                Message
              </label>
              <textarea
                id="supportMessage"
                className="app-input app-textarea"
                rows="6"
                placeholder="Tell us how we can help"
              />
            </div>

            <div className="form-actions">
              <button className="app-button app-button-primary" type="submit">
                Send message
              </button>
            </div>
          </form>
        </article>

        <article className="app-card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Frequently asked questions</h2>
              <p className="card-subtitle">Quick answers to common product questions.</p>
            </div>
          </div>

          <div className="support-stack">
            <div className="support-item">
              <strong>How do round-up savings work?</strong>
              <span className="muted">
                Enter a transaction amount and AirSave calculates the amount needed to round up to the next ten.
              </span>
            </div>
            <div className="support-item">
              <strong>Can I direct savings into a goal?</strong>
              <span className="muted">
                Yes. Choose a goal destination when saving and the progress will update automatically.
              </span>
            </div>
            <div className="support-item">
              <strong>How often does my dashboard refresh?</strong>
              <span className="muted">
                The dashboard syncs live data automatically every five seconds while you stay on the page.
              </span>
            </div>
          </div>
        </article>
      </section>
    </Layout>
  );
}
