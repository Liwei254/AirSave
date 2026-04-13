export default function Layout({ eyebrow, title, subtitle, actions, children, shellClassName = "" }) {
  const shellClasses = ["app-shell", shellClassName].filter(Boolean).join(" ");

  return (
    <main className={shellClasses}>
      {(eyebrow || title || subtitle || actions) ? (
        <header className="page-header">
          <div>
            {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
            {title ? <h1 className="page-title">{title}</h1> : null}
            {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="header-actions">{actions}</div> : null}
        </header>
      ) : null}

      {children}
    </main>
  );
}
