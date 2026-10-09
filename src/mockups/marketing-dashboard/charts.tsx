// Chart views for the marketing mock. Plain HTML, no chart library.
// Every bar prints its value, so color is never the only signal.

/* ── Horizontal bar list: one metric of a table, one row per table row ── */

export type BarItem = { label: string; value: number | null; text: string; nested?: boolean };

/** Plain HTML bars. Every row prints its value, so color and length are never the only signal. */
export const BarList = ({ items, title }: { items: BarItem[]; title: string }) => {
  const max = Math.max(0, ...items.map((i) => i.value ?? 0)) || 1;
  return (
    <ul className="mkd-bars" aria-label={title}>
      {items.map((item) => (
        <li key={item.label} className={`mkd-bar-row${item.nested ? " mkd-bar-row--nested" : ""}`}>
          <span className="mkd-bar-label">{item.label}</span>
          <span className="mkd-bar-track" aria-hidden="true">
            {item.value !== null && item.value > 0 && (
              <span className="mkd-bar-fill" style={{ width: `${(item.value / max) * 100}%` }} />
            )}
          </span>
          <span className="mkd-bar-value">{item.text}</span>
        </li>
      ))}
    </ul>
  );
};
