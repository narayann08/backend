/**
 * Panel container used by every dashboard widget — an instrument face rather
 * than a card: square corners, a hairline rule under a mono panel label, and
 * registration ticks on two corners.
 *
 * `title`/`subtitle`/`actions` render a consistent header; `bodyClassName`
 * lets callers make the body scroll or drop padding (the map needs both).
 */
export default function Card({
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
  className = '',
  bodyClassName = 'p-4',
  as: Tag = 'section',
}) {
  return (
    <Tag
      className={`fc-ticks relative flex flex-col rounded-[3px] border border-line bg-surface-raised shadow-[0_18px_44px_-34px_rgb(15_23_42/0.5)] ${className}`}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            {Icon && <Icon className="size-3.5 shrink-0 text-brand" aria-hidden="true" />}
            <div className="min-w-0">
              {title && <h2 className="fc-label truncate text-ink">{title}</h2>}
              {subtitle && <p className="truncate text-xs text-ink-muted">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </Tag>
  );
}
