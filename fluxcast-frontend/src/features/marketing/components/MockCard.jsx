/**
 * Shared chrome for the illustrative mockups — a panel on an instrument face.
 *
 * Both graphics render inside one of these, which is what makes the hero
 * readout and the smaller USP mockups read as one machine. The corner ticks
 * and the mono caption bar carry most of that character.
 */
export default function MockCard({
  label,
  caption,
  className = '',
  bleed = false,
  children,
  ...rest
}) {
  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-[3px] border border-mkt-line bg-mkt-raised shadow-[0_24px_60px_-30px_rgb(15_23_42/0.45)] ${className}`}
      {...rest}
    >
      {/* Corner ticks — registration marks, not decoration for its own sake. */}
      <span className="pointer-events-none absolute -top-px -left-px size-2.5 border-t border-l border-mkt-brand" />
      <span className="pointer-events-none absolute -top-px -right-px size-2.5 border-t border-r border-mkt-brand" />
      <span className="pointer-events-none absolute -bottom-px -left-px size-2.5 border-b border-l border-mkt-brand" />
      <span className="pointer-events-none absolute -right-px -bottom-px size-2.5 border-r border-b border-mkt-brand" />

      {label && (
        <div className="flex items-center justify-between gap-3 border-b border-mkt-line px-4 py-2.5">
          <span className="mkt-mono truncate text-[12px] tracking-[0.12em] text-mkt-dim uppercase">
            {label}
          </span>
          {caption && (
            <span className="mkt-mono flex shrink-0 items-center gap-1.5 text-[12px] text-mkt-brand-deep">
              <span className="relative flex size-1.5">
                <span className="mkt-blip absolute inline-flex size-full rounded-full bg-mkt-signal" />
                <span className="relative inline-flex size-1.5 rounded-full bg-mkt-signal" />
              </span>
              {caption}
            </span>
          )}
        </div>
      )}

      <div className={`min-h-0 flex-1 ${bleed ? '' : 'p-4'}`}>{children}</div>
    </div>
  );
}
