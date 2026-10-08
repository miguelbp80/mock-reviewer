// Hand-made SVG charts for the marketing mock. No chart library.
// Colors come from the --hap-* tokens and the proposed status tokens (via style, so they follow the theme).
// Color is never the only signal: every status also prints text.

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const fill = (token: string) => ({ fill: `var(${token})` });
const ink = { fill: "var(--hap-text)" };
const muted = { fill: "var(--hap-text-light)" };
const good = { fill: "var(--hap-good-ink)" };
const bad = { fill: "var(--hap-bad-ink)" };

/* ── Cost per opportunity by channel, with the maximum as a dashed line ── */

export type CostBar = { label: string; value: number | null };

export const CostPerOpportunityChart = ({
  items,
  max,
  title,
}: {
  items: CostBar[];
  max: number | null;
  title: string;
}) => {
  const values = items.map((i) => i.value).filter((v): v is number => v !== null);
  if (values.length === 0 || max === null) {
    return <p className="mkd-empty">No paid channels with opportunities for this selection.</p>;
  }

  const W = 360;
  const H = 250;
  const padX = 16;
  const top = 30;
  const bottom = 54;
  const plotH = H - top - bottom;
  const scaleMax = Math.max(max, ...values) * 1.15;
  const y = (v: number) => top + plotH - (v / scaleMax) * plotH;
  const slot = (W - padX * 2) / items.length;
  const barW = Math.min(56, slot * 0.55);
  const baseline = top + plotH;

  // Difference of the rounded figures, so the numbers on screen subtract exactly.
  const diff = (v: number) => Math.abs(Math.round(max) - Math.round(v));
  const status = (v: number) => (v <= max ? `${money.format(diff(v))} under max` : `${money.format(diff(v))} over max`);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-labelledby="cpo-title cpo-desc">
      <title id="cpo-title">{title}</title>
      <desc id="cpo-desc">
        {items
          .map((i) => `${i.label}: ${i.value === null ? "no data" : `${money.format(i.value)}, ${status(i.value)}`}`)
          .join(". ")}
        . Maximum {money.format(max)}.
      </desc>

      <line x1={padX} x2={W - padX} y1={baseline} y2={baseline} style={{ stroke: "var(--hap-neutral)" }} />

      {items.map((item, i) => {
        const cx = padX + slot * i + slot / 2;
        const x = cx - barW / 2;
        if (item.value === null) {
          return (
            <text key={item.label} x={cx} y={baseline - 8} textAnchor="middle" style={muted} fontSize="13">
              No data
            </text>
          );
        }
        const within = item.value <= max;
        return (
          <g key={item.label} className="mkd-bar">
            <title>{`${item.label}: ${money.format(item.value)} per opportunity, ${status(item.value)}`}</title>
            <rect
              x={x}
              y={y(item.value)}
              width={barW}
              height={baseline - y(item.value)}
              rx="2"
              style={fill(within ? "--hap-good" : "--hap-bad")}
            />
            <text x={cx} y={y(item.value) - 6} textAnchor="middle" style={halo} fontSize="13" fontWeight="700">
              {money.format(item.value)}
            </text>
            <text x={cx} y={baseline + 18} textAnchor="middle" style={ink} fontSize="13" fontWeight="600">
              {item.label}
            </text>
            <text x={cx} y={baseline + 36} textAnchor="middle" style={within ? good : bad} fontSize="12" fontWeight="600">
              {status(item.value)}
            </text>
          </g>
        );
      })}

      <line
        x1={padX}
        x2={W - padX}
        y1={y(max)}
        y2={y(max)}
        strokeDasharray="6 4"
        style={{ stroke: "var(--hap-text)" }}
        strokeWidth="1.5"
      />
      <text x={padX} y={y(max) - 6} textAnchor="start" style={ink} fontSize="12" fontWeight="600">
        Max {money.format(max)}
      </text>
    </svg>
  );
};

// Halo in the page color keeps value labels readable where the dashed max line crosses them.
const halo = { ...ink, stroke: "var(--hap-bg-light)", strokeWidth: 4, paintOrder: "stroke" as const };

/* ── Sales vs spend by campaign, grouped horizontal bars with a return label ── */

export type SalesSpendRow = { name: string; sales: number; spend: number };

export const SalesVsSpendChart = ({ items, title }: { items: SalesSpendRow[]; title: string }) => {
  if (items.length === 0) {
    return <p className="mkd-empty">No campaigns for this selection.</p>;
  }

  const W = 360;
  const rowH = 70;
  const H = items.length * rowH + 8;
  const left = 16;
  const barAreaW = 230;
  const scaleMax = Math.max(...items.flatMap((i) => [i.sales, i.spend])) || 1;
  const len = (v: number) => (v / scaleMax) * barAreaW;
  const returnOf = (i: SalesSpendRow) => (i.spend ? i.sales / i.spend : 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-labelledby="svs-title svs-desc">
      <title id="svs-title">{title}</title>
      <desc id="svs-desc">
        {items
          .map(
            (i) =>
              `${i.name}: sales ${money.format(i.sales)}, spend ${money.format(i.spend)}, return ${returnOf(i).toFixed(1)} times`,
          )
          .join(". ")}
        .
      </desc>

      {items.map((item, i) => {
        const rowTop = i * rowH + 4;
        const salesY = rowTop + 22;
        const spendY = rowTop + 40;
        const ret = returnOf(item);
        return (
          <g key={item.name} className="mkd-bar">
            <title>{`${item.name}: ${money.format(item.sales)} in sales on ${money.format(item.spend)} of spend, ${ret.toFixed(1)}x`}</title>
            <text x={left} y={rowTop + 12} style={ink} fontSize="13" fontWeight="600">
              {item.name}
            </text>
            <text x={W - left} y={rowTop + 12} textAnchor="end" style={ret >= 1 ? good : bad} fontSize="13" fontWeight="700">
              {ret.toFixed(1)}x return
            </text>
            <rect x={left} y={salesY} width={Math.max(len(item.sales), 1)} height="14" rx="2" style={fill("--hap-accent")} />
            <text x={left + len(item.sales) + 4} y={salesY + 11} style={ink} fontSize="12" fontWeight="700">
              {money.format(item.sales)}
            </text>
            <rect x={left} y={spendY} width={Math.max(len(item.spend), 1)} height="14" rx="2" style={fill("--hap-text-light")} />
            <text x={left + len(item.spend) + 4} y={spendY + 11} style={muted} fontSize="12">
              {money.format(item.spend)}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
