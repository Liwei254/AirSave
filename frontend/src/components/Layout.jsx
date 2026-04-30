import PageShell from "./PageShell.jsx";

export default function Layout({ eyebrow, title, subtitle, actions, children, shellClassName = "" }) {
  return (
    <PageShell eyebrow={eyebrow} title={title} subtitle={subtitle} actions={actions} className={shellClassName}>
      {children}
    </PageShell>
  );
}
