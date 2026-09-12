import { Link } from 'react-router-dom';

/**
 * Call-to-action. Router `Link` for in-app destinations (`to`), plain anchor
 * for in-page hashes (`href`).
 *
 * Square-cornered and mono-labelled to match the instrument vocabulary — the
 * rounded pill is the one shape this page deliberately never uses.
 */

const VARIANTS = {
  solar:
    'bg-mkt-ink text-white hover:bg-mkt-brand-deep shadow-[0_14px_30px_-14px] shadow-mkt-ink/70',
  outline:
    'border border-mkt-brand/40 text-mkt-brand-deep hover:border-mkt-brand hover:bg-mkt-brand/8',
  quiet: 'border border-mkt-line bg-mkt-raised text-mkt-ink hover:border-mkt-dim',
};

const SIZES = {
  md: 'px-7 py-3.5 text-[14px]',
  sm: 'px-4 py-2.5 text-[13px]',
};

const BASE =
  'mkt-mono inline-flex items-center justify-center gap-2.5 tracking-[0.08em] uppercase transition-all duration-200';

export default function CtaButton({
  to,
  href,
  variant = 'solar',
  size = 'md',
  icon: Icon,
  children,
  className = '',
}) {
  const classes = `${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${className}`;
  const content = (
    <>
      {children}
      {Icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <a href={href} className={classes}>
      {content}
    </a>
  );
}
