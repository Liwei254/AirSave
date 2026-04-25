import PageContainer from "./PageContainer.jsx";
import SectionHeader from "./SectionHeader.jsx";

export default function Layout({ eyebrow, title, subtitle, actions, children, shellClassName = "" }) {
  return (
    <main className={["app-shell", shellClassName].filter(Boolean).join(" ")}>
      <PageContainer className="page-stack">
        {(eyebrow || title || subtitle || actions) ? (
          <SectionHeader eyebrow={eyebrow} title={title} subtitle={subtitle} actions={actions} className="page-header" />
        ) : null}
        {children}
      </PageContainer>
    </main>
  );
}
