import { useEffect, useState } from "react";

export default function UtilityPanel({
  eyebrow,
  title,
  children,
  className = "",
  collapsible = false,
  defaultOpen = true
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  if (!collapsible) {
    return (
      <section className={`panel-section utility-panel ${className}`.trim()}>
        <div className="utility-panel-header">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2>{title}</h2>
          </div>
        </div>
        <div className="utility-panel-body">
          {children}
        </div>
      </section>
    );
  }

  return (
    <section className={`panel-section utility-panel ${open ? "open" : "collapsed"} ${className}`.trim()}>
      <div className="utility-panel-header">
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
        </div>
        <button
          aria-expanded={open}
          className="secondary compact panel-toggle"
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>
      {open ? <div className="utility-panel-body">{children}</div> : null}
    </section>
  );
}
