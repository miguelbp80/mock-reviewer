import { Fragment, useId, useState } from "react";
import { ChartColumn, ChevronRight, Moon, Sun, Table2 } from "lucide-react";
import type { MockupMeta } from "../../mockups";
import { CHANNELS, LINES, getCampaigns, getChannelRows, getMarkets } from "./data";
import type { ChannelId, ChannelRow, LineId, MarketRow, Metrics, PaidChannelId } from "./data";
import { BarList } from "./charts";
import type { BarItem } from "./charts";
import { PeriodPicker, presetRange, rangeDays, rangeLabel, startOfDay } from "./period";
import type { DateRange, Preset } from "./period";
import "./styles.css";

export const meta: MockupMeta = {
  id: "marketing-dashboard-7qk2m9v4",
  title: "Marketing dashboard",
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const count = new Intl.NumberFormat("en-US");
const percent = (part: number, whole: number) => (whole ? `${((part / whole) * 100).toFixed(1)}%` : "n/a");

const NO_SPEND = "No spend data";

/* ── Data helpers ─────────────────────────────────────────────────────────── */

const sumMetrics = (rows: Metrics[]): Metrics =>
  rows.reduce(
    (acc, r) => ({
      leads: acc.leads + r.leads,
      qualified: acc.qualified + r.qualified,
      sentToRes: acc.sentToRes + r.sentToRes,
      opportunities: acc.opportunities + r.opportunities,
      closedWon: acc.closedWon + r.closedWon,
      sales: acc.sales + r.sales,
    }),
    { leads: 0, qualified: 0, sentToRes: 0, opportunities: 0, closedWon: 0, sales: 0 },
  );

/** Sums rows. Cost metrics use only channels with paid spend, so blank-spend channels don't dilute them. */
const totals = (rows: ChannelRow[]) => {
  const paid = rows.filter((r) => r.spend !== null);
  return {
    ...sumMetrics(rows),
    paid: {
      ...sumMetrics(paid),
      spend: paid.length ? paid.reduce((acc, r) => acc + (r.spend ?? 0), 0) : null,
    },
  };
};

type Totals = ReturnType<typeof totals>;

const addTotals = (a: Totals, b: Totals): Totals => ({
  ...sumMetrics([a, b]),
  paid: {
    ...sumMetrics([a.paid, b.paid]),
    spend: a.paid.spend === null && b.paid.spend === null ? null : (a.paid.spend ?? 0) + (b.paid.spend ?? 0),
  },
});

const costPer = (spend: number | null, denominator: number) => {
  if (spend === null) return NO_SPEND;
  if (!denominator) return "n/a";
  return money.format(spend / denominator);
};

/* ── Sorting ──────────────────────────────────────────────────────────────── */

type SortState<K extends string> = { key: K; dir: "asc" | "desc" } | null;

/** Header click cycles: high to low, low to high, original order. */
const nextSort = <K extends string>(cur: SortState<K>, key: K): SortState<K> => {
  if (!cur || cur.key !== key) return { key, dir: "desc" };
  return cur.dir === "desc" ? { key, dir: "asc" } : null;
};

/** Stable sort by a numeric value. Rows without a value (null) always go last. */
const sortRows = <T, K extends string>(
  rows: T[],
  sort: SortState<K>,
  value: (row: T, key: K) => number | null,
): T[] => {
  if (!sort) return rows;
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = value(a, sort.key);
    const vb = value(b, sort.key);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return (va - vb) * sign;
  });
};

type ResultKey = "spend" | "leads" | "costLead" | "costQualified" | "costOpportunity" | "closedWon" | "sales";
type ResultValues = Metrics & { spend: number | null };

const RESULT_COLUMNS: { key: ResultKey; label: string }[] = [
  { key: "spend", label: "Spend" },
  { key: "leads", label: "Leads" },
  { key: "costLead", label: "Cost per lead" },
  { key: "costQualified", label: "Cost per qualified lead" },
  { key: "costOpportunity", label: "Cost per opportunity" },
  { key: "closedWon", label: "Closed won" },
  { key: "sales", label: "Sales" },
];

const resultValue = (r: ResultValues, key: ResultKey): number | null => {
  const cost = (n: number) => (r.spend === null || !n ? null : r.spend / n);
  switch (key) {
    case "spend":
      return r.spend;
    case "leads":
      return r.leads;
    case "costLead":
      return cost(r.leads);
    case "costQualified":
      return cost(r.qualified);
    case "costOpportunity":
      return cost(r.opportunities);
    case "closedWon":
      return r.closedWon;
    case "sales":
      return r.sales;
  }
};

/** The text the table prints for one cell, reused by the chart labels. */
const resultText = (r: ResultValues, key: ResultKey): string => {
  const v = resultValue(r, key);
  if (v === null) return r.spend === null ? NO_SPEND : "n/a";
  return key === "leads" || key === "closedWon" ? count.format(v) : money.format(v);
};

type MarketKey = keyof Omit<MarketRow, "market">;

const MARKET_COLUMNS: { key: MarketKey; label: string }[] = [
  { key: "leads", label: "Total leads" },
  { key: "qualified", label: "Qualified" },
  { key: "sentToRes", label: "Sent to RES" },
  { key: "opportunities", label: "Opportunities" },
  { key: "closedWon", label: "Closed won" },
];

/* ── Small components ─────────────────────────────────────────────────────── */

type View = "table" | "chart";

const ViewToggle = ({ view, onChange, label }: { view: View; onChange: (v: View) => void; label: string }) => (
  <div role="group" aria-label={label} className="mkd-view">
    <button
      type="button"
      className="mkd-icon-btn"
      aria-label="Table view"
      title="Table view"
      aria-pressed={view === "table"}
      onClick={() => onChange("table")}
    >
      <Table2 size={18} aria-hidden="true" />
    </button>
    <button
      type="button"
      className="mkd-icon-btn"
      aria-label="Chart view"
      title="Chart view"
      aria-pressed={view === "chart"}
      onClick={() => onChange("chart")}
    >
      <ChartColumn size={18} aria-hidden="true" />
    </button>
  </div>
);

const MetricSelect = ({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { key: string; label: string }[];
  onChange: (key: string) => void;
}) => (
  <label className="mkd-metric-select">
    <span>Metric</span>
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
);

const SortTh = <K extends string>({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
}) => {
  const active = sort?.key === sortKey;
  const ariaSort = active ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
  return (
    <th scope="col" aria-sort={ariaSort} className={active ? "is-sorted" : undefined}>
      <button type="button" className="mkd-sort" onClick={() => onSort(sortKey)}>
        {label}
        <span className="mkd-sort-mark" aria-hidden="true">
          {active ? (sort.dir === "asc" ? "↑" : "↓") : ""}
        </span>
      </button>
    </th>
  );
};

/* ── Page ─────────────────────────────────────────────────────────────────── */

const prefersDark = () => {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
};

const MarketingDashboard = () => {
  const [line, setLine] = useState<LineId>("hap");
  const [today] = useState(() => startOfDay(new Date()));
  const [preset, setPreset] = useState<Preset>("month");
  const [custom, setCustom] = useState<DateRange | null>(null);
  const [dark, setDark] = useState(prefersDark);
  const [openChannels, setOpenChannels] = useState<Partial<Record<ChannelId, boolean>>>({});
  const [resultView, setResultView] = useState<View>("table");
  const [marketView, setMarketView] = useState<View>("table");
  const [resultMetric, setResultMetric] = useState<ResultKey>("leads");
  const [marketMetric, setMarketMetric] = useState<MarketKey>("leads");
  const [resultSort, setResultSort] = useState<SortState<ResultKey>>(null);
  const [marketSort, setMarketSort] = useState<SortState<MarketKey>>(null);
  const panelId = useId();
  const tabId = (id: LineId) => `${panelId}-tab-${id}`;

  // RES has no data yet. Add its view here when the HubSpot migration lands.
  const hasData = line === "hap";

  const range = presetRange(preset, today, custom);
  const days = rangeDays(range);

  const channelIds = CHANNELS.map((c) => c.id);
  const channelName = (id: ChannelId) => CHANNELS.find((c) => c.id === id)!.label;
  const byChannel = getChannelRows(line, days);
  const campaigns = getCampaigns(line, days);
  const lineTotals = totals(channelIds.map((id) => byChannel[id]));

  // Key totals are global: HAP and RES combined, so they do not change with the line tab.
  const t = LINES.map((l) => getChannelRows(l.id, days))
    .map((rows) => totals(channelIds.map((id) => rows[id])))
    .reduce(addTotals);

  const tiles = [
    { label: "Total leads", value: t.leads, cost: costPer(t.paid.spend, t.paid.leads), share: null },
    {
      label: "Total qualified",
      value: t.qualified,
      cost: costPer(t.paid.spend, t.paid.qualified),
      share: percent(t.qualified, t.leads),
    },
    {
      label: "Total opportunities",
      value: t.opportunities,
      cost: costPer(t.paid.spend, t.paid.opportunities),
      share: percent(t.opportunities, t.leads),
    },
    {
      label: "Closed won",
      value: t.closedWon,
      cost: costPer(t.paid.spend, t.paid.closedWon),
      share: percent(t.closedWon, t.leads),
    },
    {
      label: "Total sent to RES",
      value: t.sentToRes,
      cost: costPer(t.paid.spend, t.paid.sentToRes),
      share: percent(t.sentToRes, t.leads),
    },
  ];

  /** Total row of the results table. Cost cells use paid channels only, like the tiles. */
  const totalCell = (key: ResultKey): string => {
    const p = lineTotals.paid;
    switch (key) {
      case "spend":
        return p.spend === null ? NO_SPEND : money.format(p.spend);
      case "leads":
        return count.format(lineTotals.leads);
      case "costLead":
        return costPer(p.spend, p.leads);
      case "costQualified":
        return costPer(p.spend, p.qualified);
      case "costOpportunity":
        return costPer(p.spend, p.opportunities);
      case "closedWon":
        return count.format(lineTotals.closedWon);
      case "sales":
        return money.format(lineTotals.sales);
    }
  };

  const sortedChannels = sortRows(channelIds, resultSort, (id, k) => resultValue(byChannel[id], k));
  const paidIds = CHANNELS.filter((c) => c.paid).map((c) => c.id);
  const allOpen = paidIds.every((id) => openChannels[id]);
  const toggleAll = () =>
    setOpenChannels(Object.fromEntries(paidIds.map((id) => [id, !allOpen])) as Partial<Record<ChannelId, boolean>>);

  // Chart rows follow the table: same order, and campaigns appear for the channels that are open.
  const resultBars: BarItem[] = sortedChannels.flatMap((id) => {
    const rows: BarItem[] = [
      {
        label: channelName(id),
        value: resultValue(byChannel[id], resultMetric),
        text: resultText(byChannel[id], resultMetric),
      },
    ];
    if (id !== "blog" && openChannels[id]) {
      sortRows(campaigns[id as PaidChannelId], resultSort, resultValue).forEach((c) =>
        rows.push({ label: c.name, value: resultValue(c, resultMetric), text: resultText(c, resultMetric), nested: true }),
      );
    }
    return rows;
  });

  const markets = sortRows(getMarkets(line, days), marketSort, (m, k) => m[k]);
  const marketTotals = sumMetrics(markets.map((m) => ({ ...m, sales: 0 })));
  const maxMarketLeads = Math.max(1, ...markets.map((m) => m.leads));
  const marketBars: BarItem[] = markets.map((m) => ({
    label: m.market,
    value: m[marketMetric],
    text: count.format(m[marketMetric]),
  }));

  return (
    <div className={`mkd-root${dark ? " is-dark" : ""}`}>
      <main className="mkd">
        <header className="mkd-header">
          <div className="mkd-title-wrap">
            <h1 className="mkd-title">Marketing dashboard</h1>
            <p className="mkd-range">{rangeLabel(range)}</p>
          </div>
          <div className="mkd-header-tools">
            <PeriodPicker
              preset={preset}
              custom={custom}
              today={today}
              onChange={(p, r) => {
                setPreset(p);
                if (r) setCustom(r);
              }}
            />
            <button
              type="button"
              className="mkd-icon-btn mkd-theme"
              aria-pressed={dark}
              aria-label="Dark mode"
              title="Dark mode"
              onClick={() => setDark((v) => !v)}
            >
              {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
            </button>
          </div>
        </header>

        <section className="mkd-sticky" aria-label="Key totals">
          <dl className="mkd-tiles">
            {tiles.map((tile) => (
              <div className="mkd-tile" key={tile.label}>
                <dt className="mkd-tile-label">{tile.label}</dt>
                <dd className="mkd-tile-value">{count.format(tile.value)}</dd>
                <dd className="mkd-tile-meta">
                  <span>
                    <span className="mkd-tile-key">Cost</span> {tile.cost}
                  </span>
                  {tile.share && (
                    <span>
                      <span className="mkd-tile-key">Of leads</span> {tile.share}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <div role="tablist" aria-label="Business line" className="mkd-tabs">
          {LINES.map((l) => (
            <button
              key={l.id}
              id={tabId(l.id)}
              role="tab"
              type="button"
              className="mkd-tab"
              aria-selected={line === l.id}
              aria-controls={`${panelId}-panel`}
              onClick={() => setLine(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div id={`${panelId}-panel`} role="tabpanel" aria-labelledby={tabId(line)} className="mkd-stack">
          {hasData ? (
            <>
              <section className="mkd-block" aria-labelledby={`${panelId}-results`}>
                <div className="mkd-block-head">
                  <h2 id={`${panelId}-results`}>Results by channel and campaign</h2>
                  <div className="mkd-block-tools">
                    {resultView === "chart" ? (
                      <MetricSelect
                        value={resultMetric}
                        options={RESULT_COLUMNS}
                        onChange={(k) => setResultMetric(k as ResultKey)}
                      />
                    ) : (
                      <button type="button" className="mkd-text-btn" onClick={toggleAll}>
                        {allOpen ? "Collapse all" : "Expand all"}
                      </button>
                    )}
                    <ViewToggle view={resultView} onChange={setResultView} label="Results view" />
                  </div>
                </div>

                {resultView === "table" ? (
                  <div className="mkd-table-wrap" tabIndex={0}>
                    <table className="mkd-table" aria-labelledby={`${panelId}-results`}>
                      <thead>
                        <tr>
                          <th scope="col">Channel / campaign</th>
                          {RESULT_COLUMNS.map((c) => (
                            <SortTh
                              key={c.key}
                              label={c.label}
                              sortKey={c.key}
                              sort={resultSort}
                              onSort={(k) => setResultSort((s) => nextSort(s, k))}
                            />
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedChannels.map((id) => {
                          const r = byChannel[id];
                          const paid = id !== "blog";
                          const list = paid ? sortRows(campaigns[id as PaidChannelId], resultSort, resultValue) : [];
                          const isOpen = Boolean(openChannels[id]);
                          const rowIds = list.map((_, i) => `${panelId}-${id}-${i}`).join(" ");
                          return (
                            <Fragment key={id}>
                              <tr className="mkd-row-channel">
                                <th scope="row">
                                  {paid ? (
                                    <button
                                      type="button"
                                      className="mkd-row-toggle"
                                      aria-expanded={isOpen}
                                      aria-controls={rowIds}
                                      onClick={() => setOpenChannels((prev) => ({ ...prev, [id]: !prev[id] }))}
                                    >
                                      <ChevronRight size={16} className="mkd-chevron" aria-hidden="true" />
                                      {channelName(id)}
                                      <span className="mkd-row-count">{list.length} campaigns</span>
                                    </button>
                                  ) : (
                                    <span className="mkd-row-plain">
                                      {channelName(id)}
                                      <span className="mkd-row-count">Organic</span>
                                    </span>
                                  )}
                                </th>
                                {RESULT_COLUMNS.map((c) => (
                                  <td key={c.key} className={c.key === resultSort?.key ? "is-sorted" : undefined}>
                                    {resultText(r, c.key)}
                                  </td>
                                ))}
                              </tr>
                              {list.map((c, i) => (
                                <tr key={c.name} id={`${panelId}-${id}-${i}`} className="mkd-row-campaign" hidden={!isOpen}>
                                  <th scope="row">{c.name}</th>
                                  {RESULT_COLUMNS.map((col) => (
                                    <td key={col.key} className={col.key === resultSort?.key ? "is-sorted" : undefined}>
                                      {resultText(c, col.key)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </Fragment>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <th scope="row">All channels</th>
                          {RESULT_COLUMNS.map((c) => (
                            <td key={c.key}>{totalCell(c.key)}</td>
                          ))}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <BarList
                    title={`${RESULT_COLUMNS.find((m) => m.key === resultMetric)!.label} by channel and campaign`}
                    items={resultBars}
                  />
                )}
              </section>

              <section className="mkd-block" aria-labelledby={`${panelId}-markets`}>
                <div className="mkd-block-head">
                  <h2 id={`${panelId}-markets`}>Leads by market</h2>
                  <div className="mkd-block-tools">
                    {marketView === "chart" && (
                      <MetricSelect
                        value={marketMetric}
                        options={MARKET_COLUMNS}
                        onChange={(k) => setMarketMetric(k as MarketKey)}
                      />
                    )}
                    <ViewToggle view={marketView} onChange={setMarketView} label="Markets view" />
                  </div>
                </div>
                {/* TODO: ZIP to market mapping is pending (Salesforce ZIP + reference sheet). Data comes pre-aggregated. */}

                  {marketView === "table" ? (
                    <div className="mkd-table-wrap" tabIndex={0}>
                      <table className="mkd-table mkd-table--markets" aria-labelledby={`${panelId}-markets`}>
                        <thead>
                          <tr>
                            <th scope="col">Market</th>
                            {MARKET_COLUMNS.map((c) => (
                              <SortTh
                                key={c.key}
                                label={c.label}
                                sortKey={c.key}
                                sort={marketSort}
                                onSort={(k) => setMarketSort((s) => nextSort(s, k))}
                              />
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {markets.map((m) => (
                            <tr key={m.market} className="mkd-row-channel">
                              <th scope="row">{m.market}</th>
                              {MARKET_COLUMNS.map((c) => (
                                <td key={c.key} className={c.key === marketSort?.key ? "is-sorted" : undefined}>
                                  {c.key === "leads" ? (
                                    <span className="mkd-databar">
                                      <span
                                        className="mkd-databar-fill"
                                        aria-hidden="true"
                                        style={{ width: `${(m.leads / maxMarketLeads) * 100}%` }}
                                      />
                                      <span className="mkd-databar-num">{count.format(m.leads)}</span>
                                    </span>
                                  ) : (
                                    count.format(m[c.key])
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <th scope="row">All markets</th>
                            {MARKET_COLUMNS.map((c) => (
                              <td key={c.key}>{count.format(marketTotals[c.key])}</td>
                            ))}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <BarList
                      title={`${MARKET_COLUMNS.find((m) => m.key === marketMetric)!.label} by market`}
                      items={marketBars}
                    />
                  )}
              </section>
            </>
          ) : (
            <section className="mkd-empty-state" aria-label="RES">
              <p>RES data is not available yet. It will be added after the Follow Up Boss migration to HubSpot.</p>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

export default MarketingDashboard;
