/**
 * One band of the landing page.
 *
 * Every band is light, on the same two surfaces the console itself uses;
 * bands are separated by a hairline rather than a colour swing, so the page
 * reads as one continuous instrument face. The mono `label` doubles as the
 * section's index.
 */

const TONES = {
  surface: 'bg-mkt-surface text-mkt-ink',
  sunken: 'bg-mkt-sunken text-mkt-ink',
};

const RULES = {
  surface: 'border-mkt-line',
  sunken: 'border-mkt-line',
};

const LEDE = {
  surface: 'text-mkt-dim',
  sunken: 'text-mkt-dim',
};

const LABELS = {
  surface: 'text-mkt-brand-deep',
  sunken: 'text-mkt-brand-deep',
};

export default function Section({
  id,
  tone = 'surface',
  label,
  heading,
  lede,
  children,
  className = '',
}) {
  const headingId = id ? `${id}-heading` : undefined;

  return (
    <section
      id={id}
      aria-labelledby={heading ? headingId : undefined}
      className={`border-t ${RULES[tone]} ${TONES[tone]} px-5 py-20 sm:px-8 lg:py-28 ${className}`}
    >
      <div className="mx-auto w-full max-w-6xl">
        {(label || heading) && (
          <header className="mkt-reveal max-w-3xl">
            {label && (
              <p className={`mkt-mono text-[13px] tracking-[0.16em] uppercase ${LABELS[tone]}`}>
                {label}
              </p>
            )}
            {heading && (
              <h2 id={headingId} className="mt-5 text-4xl leading-[1.08] text-balance sm:text-5xl">
                {heading}
              </h2>
            )}
            {lede && (
              <p className={`mt-5 max-w-2xl text-lg text-pretty ${LEDE[tone]}`}>{lede}</p>
            )}
          </header>
        )}
        {children && <div className={heading ? 'mt-14 sm:mt-20' : ''}>{children}</div>}
      </div>
    </section>
  );
}
