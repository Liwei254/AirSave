import Button from "../components/Button.jsx";
import ConfirmSummaryCard from "../components/ConfirmSummaryCard.jsx";
import FormSection from "../components/FormSection.jsx";
import FormCard from "../components/FormCard.jsx";
import FormPageLayout from "../components/FormPageLayout.jsx";
import Input from "../components/Input.jsx";
import Layout from "../components/Layout.jsx";

export default function Support() {
  return (
    <Layout
      eyebrow="Support"
      title="We&apos;re here to help."
      subtitle="Reach out for account questions, product help, or guidance on how to get the most from AirSave."
      shellClassName="support-page-shell"
    >
      <form onSubmit={(event) => event.preventDefault()}>
        <FormPageLayout>
        <FormCard>
          <div className="fin-form-stack">
            <FormSection title="Contact us" active>
              <div className="fin-form-two-col">
                <Input label="Name" type="text" placeholder="Your full name" />
                <Input label="Email" type="email" placeholder="you@example.com" />
              </div>
              <Input
                as="textarea"
                label="Message"
                className="fin-form-textarea"
                rows="6"
                placeholder="Tell us how we can help"
              />
            </FormSection>
          </div>
        </FormCard>

        <ConfirmSummaryCard
          eyebrow="Support"
          title="What to expect"
          footer={(
            <Button type="submit" fullWidth>
              Send message
            </Button>
          )}
        >
          <div className="fin-summary-metric">
            <span>Response time</span>
            <strong>Within 1 business day</strong>
          </div>
          <div className="fin-summary-metric">
            <span>Best for</span>
            <strong>Account, product, and payments help</strong>
          </div>
          <div className="support-stack fin-summary-list">
            <div className="support-item">
              <strong>Round-up savings</strong>
              <span className="muted">AirSave calculates the difference to your selected round-up rule and saves it automatically.</span>
            </div>
            <div className="support-item">
              <strong>Goal destination</strong>
              <span className="muted">Round-ups move into your active goal automatically, or into your savings wallet if no goal is active.</span>
            </div>
          </div>
        </ConfirmSummaryCard>
        </FormPageLayout>
      </form>
    </Layout>
  );
}
