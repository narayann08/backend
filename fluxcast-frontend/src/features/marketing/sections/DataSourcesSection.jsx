import { MARKETING_ICONS } from '../icons';
import { DATA_SOURCES } from '../content';

/*
 * Text lockups rather than official logos — these are the feeds the backend
 * actually reads, and nothing here should imply a formal partnership.
 */
export default function DataSourcesSection() {
  return (
    <section id="data-sources" className="border-t border-mkt-line bg-mkt-surface px-5 py-12 sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 md:flex-row md:items-center md:gap-14">
        <h2 className="mkt-mono shrink-0 text-[12px] tracking-[0.16em] text-mkt-dim uppercase">
          {DATA_SOURCES.heading}
        </h2>
        <ul className="flex flex-wrap items-center gap-x-12 gap-y-5">
          {DATA_SOURCES.items.map((item) => {
            const Icon = MARKETING_ICONS[item.icon];
            return (
              <li key={item.id} className="flex items-center gap-3">
                <Icon className="size-4 shrink-0 text-mkt-signal/70" aria-hidden="true" />
                <span className="text-mkt-ink">{item.label}</span>
                <span className="mkt-mono hidden text-[12px] text-mkt-dim sm:inline">
                  {item.note}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
