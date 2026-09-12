/**
 * Panel container used by every dashboard widget.
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
      className={`flex flex-col rounded-xl border border-line bg-surface-raised shadow-sm ${className}`}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {Icon && <Icon className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />}
            <div className="min-w-0">
              {title && <h2 className="truncate text-sm font-semibold text-ink">{title}</h2>}
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
