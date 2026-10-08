import { Fragment, useId, useState } from "react";
import { Moon, Sun } from "lucide-react";
import type { MockupMeta } from "../../mockups";
import {
  CHANNELS,
  LINES,
  PERIODS,
  RULES,
  getAction,
  getCampaigns,
  getChannelRows,
  getEfficiency,
  getMaxCostPerOpportunity,
} from "./data";
import type { Action, ChannelId, ChannelRow, LineId, Metrics, PaidChannelId, PeriodId } from "./data";
import { CostPerOpportunityChart, SalesVsSpendChart } from "./charts";
import "./styles.css";
import "../../styles/dark-palette.css";
import "../../styles/status-palette.css";

export const meta: MockupMeta = {
  id: "marketing-dashboard-7qk2m9v4",
  title: "Marketing dashboard",
};

type ChannelFilter = ChannelId | "all";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const count = new Intl.NumberFormat("en-US");

const NO_SPEND = "No spend data";

const sumMetrics = (rows: Metrics[]): Metrics =>
  rows.reduce(
    (acc, r) => ({
      leads: acc.leads + r.leads,
      qualified: acc.qualified + r.qualified,
      opportunities: acc.opportunities + r.opportunities,
      closedWon: acc.closedWon + r.closedWon,
      sales: acc.sales + r.sales,
    }),
    { leads: 0, qualified: 0, opportunities: 0, closedWon: 0, sales: 0 },
  );

/** Sums rows. Cost metrics use only channels with paid spend, so blank-spend channels don't dilute them. */
const totals = (rows: ChannelRow[]) => {
  const paid = rows.filter((r) => r.spend !== null);
  const paidMetrics = sumMetrics(paid);
  return {
    ...sumMetrics(rows),
    paid: {
      spend: paid.length ? paid.reduce((acc, r) => acc + (r.spend ?? 0), 0) : null,
      leads: paidMetrics.leads,
      qualified: paidMetrics.qualified,
      opportunities: paidMetrics.opportunities,
    },
  };
};

const costPer = (spend: number | null, denominator: number) => {
  if (spend === null) return NO_SPEND;
  if (!denominator) return "n/a";
  return money.format(spend / denominator);
};

const ACTION_TEXT: Record<Action, string> = {
  Scale: "Scale",
  Keep: "Keep",
  Pause: "Pause",
  "Too early": "Too early",
  Organic: "Organic",
};

type Tone = "good" | "bad" | "neutral";

const ACTION_TONE: Record<Action, Tone> = {
  Scale: "good",
  Keep: "neutral",
  Pause: "bad",
  "Too early": "neutral",
  Organic: "neutral",
};

const Status = ({ tone, children }: { tone: Tone; children: string }) => (
  <span className={`mkd-status mkd-status--${tone}`}>{children}</span>
);

/** Tone of a cost against a benchmark, with the same thresholds as the campaign action. */
const toneOf = (value: number, benchmark: number | null): Tone => {
  if (benchmark === null) return "neutral";
  if (value <= benchmark * RULES.scaleBelowRatio) return "good";
  if (value > benchmark * RULES.pauseAboveRatio) return "bad";
  return "neutral";
};

/** Colored figure. The hint is read by screen readers, so color is never the only signal. */
const Figure = ({ tone, hint, children }: { tone: Tone; hint: string; children: string }) =>
  tone === "neutral" ? (
    <>{children}</>
  ) : (
    <span className={`mkd-figure mkd-figure--${tone}`}>
      {children}
      <span className="mkd-sr-only"> ({hint})</span>
    </span>
  );

const costCell = (spend: number | null, denominator: number, benchmark: number | null) => {
  const text = costPer(spend, denominator);
  if (spend === null || !denominator) return text;
  const tone = toneOf(spend / denominator, benchmark);
  return (
    <Figure tone={tone} hint={tone === "good" ? "better than benchmark" : "worse than benchmark"}>
      {text}
    </Figure>
  );
};

/** A paid row that spent money and closed nothing is the one outcome worth flagging in red. */
const outcomeCell = (text: string, spend: number | null, closedWon: number) =>
  spend !== null && spend > 0 && closedWon === 0 ? (
    <Figure tone="bad" hint="no closings">
      {text}
    </Figure>
  ) : (
    text
  );

const MarketingDashboard = () => {
  const [line, setLine] = useState<LineId>("hap");
  const [period, setPeriod] = useState<PeriodId>("last30");
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [dark, setDark] = useState(false);
  const [openChannels, setOpenChannels] = useState<Partial<Record<ChannelId, boolean>>>({});
  const panelId = useId();
  const tabId = (id: LineId) => `${panelId}-tab-${id}`;

  const byChannel = getChannelRows(line, period);
  const selected = channel === "all" ? CHANNELS.map((c) => c.id) : [channel];
  const t = totals(selected.map((id) => byChannel[id]));
  const all = totals(CHANNELS.map((c) => byChannel[c.id]));

  const maxCpo = getMaxCostPerOpportunity(line, period);
  const efficiency = getEfficiency(line, period);
  const actualCpo = all.paid.opportunities && all.paid.spend !== null ? all.paid.spend / all.paid.opportunities : null;
  const withinMax = actualCpo !== null && maxCpo !== null && actualCpo <= maxCpo;

  const campaigns = getCampaigns(line, period);
  const campaignRows = selected
    .filter((id): id is PaidChannelId => id !== "blog")
    .flatMap((id) => campaigns[id]);

  const benchLead = all.paid.spend !== null && all.paid.leads ? all.paid.spend / all.paid.leads : null;
  const benchQualified = all.paid.spend !== null && all.paid.qualified ? all.paid.spend / all.paid.qualified : null;

  const lineCampaigns = CHANNELS.filter((c) => c.paid).flatMap((c) => campaigns[c.id as PaidChannelId]);
  const actionCount = (a: Action) => lineCampaigns.filter((c) => getAction(c, maxCpo) === a).length;
  const toScale = actionCount("Scale");
  const toPause = actionCount("Pause");
  const tooEarly = actionCount("Too early");
  // Difference of the rounded figures, so the numbers on screen subtract exactly.
  const gap = actualCpo !== null && maxCpo !== null ? Math.abs(Math.round(maxCpo) - Math.round(actualCpo)) : null;

  const costItems = CHANNELS.filter((c) => c.paid).map((c) => {
    const r = byChannel[c.id];
    return { label: c.label, value: r.spend !== null && r.opportunities ? r.spend / r.opportunities : null };
  });
  const salesItems = campaignRows.map((c) => ({ name: c.name, sales: c.sales, spend: c.spend }));

  const channelName = (id: ChannelId) => CHANNELS.find((c) => c.id === id)!.label;
  const selectionLabel = `${channel === "all" ? "All channels" : channelName(channel)}, ${PERIODS.find((p) => p.id === period)!.label}`;

  const metrics = [
    {
      label: "Cost per lead",
      value: costPer(t.paid.spend, t.paid.leads),
      sub: t.paid.spend === null ? "Blog has no paid spend" : `${count.format(t.paid.leads)} leads with spend`,
      empty: t.paid.spend === null,
    },
    {
      label: "Cost per qualified lead",
      value: costPer(t.paid.spend, t.paid.qualified),
      sub: `${count.format(t.paid.qualified)} qualified leads`,
      empty: t.paid.spend === null,
    },
    {
      label: "Cost per opportunity",
      value: costPer(t.paid.spend, t.paid.opportunities),
      sub: `${count.format(t.paid.opportunities)} opportunities`,
      empty: t.paid.spend === null,
    },
    {
      label: "Sales (closed won)",
      value: money.format(t.sales),
      sub: `${count.format(t.closedWon)} closed-won deals`,
      empty: false,
    },
  ];

  return (
    <div className={`hap-page-scope${dark ? " is-dark" : ""}`}>
      <main className="mkd">
        <header className="mkd-header">
          <h1 className="mkd-title">Marketing dashboard</h1>
          <button
            type="button"
            className="mkd-theme"
            aria-pressed={dark}
            aria-label="Dark mode"
            title="Dark mode"
            onClick={() => setDark((v) => !v)}
          >
            {dark ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
          </button>
        </header>

        <div className="mkd-filters">
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

          <div className="mkd-controls">
            <label className="mkd-field">
              Period
              <select className="mkd-select" value={period} onChange={(e) => setPeriod(e.target.value as PeriodId)}>
                {PERIODS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mkd-field">
              Channel
              <select
                className="mkd-select"
                value={channel}
                onChange={(e) => setChannel(e.target.value as ChannelFilter)}
              >
                <option value="all">All channels</option>
                {CHANNELS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div
          key={`${line}-${period}-${channel}`}
          id={`${panelId}-panel`}
          role="tabpanel"
          aria-labelledby={tabId(line)}
          className="mkd-stack mkd-swap"
        >
          <section className="mkd-overview" aria-label="Overview">
            <div className="mkd-hero">
              <h2>Marketing efficiency</h2>
              <p className="mkd-hero-value">{efficiency === null ? "n/a" : `${efficiency.toFixed(1)}x`}</p>
              <p className="mkd-hero-caption">
                {efficiency === null
                  ? "No marketing spend for this period."
                  : `$${efficiency.toFixed(2)} in sales for every $1 of marketing spend.`}
              </p>

              {actualCpo !== null && maxCpo !== null && gap !== null ? (
                <p className="mkd-verdict">
                  <Status tone={withinMax ? "good" : "bad"}>{withinMax ? "Within max" : "Above max"}</Status>
                  Cost per opportunity is {money.format(actualCpo)}, {money.format(gap)} {withinMax ? "under" : "over"}{" "}
                  the {money.format(maxCpo)} maximum.
                </p>
              ) : (
                <p className="mkd-verdict">No paid opportunities to compare with the maximum.</p>
              )}

              <ul className="mkd-chips" aria-label="Campaign actions across this line">
                <li>
                  <Status tone={toScale > 0 ? "good" : "neutral"}>{`${toScale} to scale`}</Status>
                </li>
                <li>
                  <Status tone={toPause > 0 ? "bad" : "neutral"}>{`${toPause} to pause`}</Status>
                </li>
                <li>
                  <Status tone="neutral">{`${tooEarly} too early`}</Status>
                </li>
              </ul>
              <p className="mkd-caption">
                All channels in this line. Target: {Math.round(RULES.targetMarketingShare * 100)}% of revenue.
              </p>
            </div>

            <div className="mkd-metrics-wrap">
              <h2>Cost and sales</h2>
              <p className="mkd-caption">{selectionLabel}</p>
              <dl className="mkd-metrics">
                {metrics.map((m) => (
                  <div className="mkd-metric" key={m.label}>
                    <dt>{m.label}</dt>
                    <dd className={`mkd-metric-value${m.empty ? " mkd-metric-value--empty" : ""}`}>{m.value}</dd>
                    <dd className="mkd-metric-sub">{m.sub}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <section className="mkd-charts" aria-label="Charts">
            <div>
              <h2>Cost per opportunity by channel</h2>
              <p className="mkd-caption">Bars under the dashed line are within the maximum.</p>
              <CostPerOpportunityChart title="Cost per opportunity by channel" items={costItems} max={maxCpo} />
            </div>

            <div>
              <h2>Sales vs spend by campaign</h2>
              <ul className="mkd-legend" aria-hidden="true">
                <li>
                  <i className="mkd-swatch mkd-swatch--sales" />
                  Sales
                </li>
                <li>
                  <i className="mkd-swatch mkd-swatch--spend" />
                  Spend
                </li>
              </ul>
              <SalesVsSpendChart title="Sales vs spend by campaign" items={salesItems} />
            </div>
          </section>

          <section className="mkd-results" aria-labelledby={`${panelId}-results`}>
            <h2 id={`${panelId}-results`}>Results by channel and campaign</h2>
            <p className="mkd-caption">
              Open a channel to see its campaigns. Green is at least {Math.round((1 - RULES.scaleBelowRatio) * 100)}%
              better than the benchmark, red is more than {Math.round((RULES.pauseAboveRatio - 1) * 100)}% worse. The
              benchmark is the line average for cost per lead and cost per qualified lead, and the maximum for cost per
              opportunity. Red also marks a paid row with no closings.
            </p>
            <div className="mkd-table-wrap" tabIndex={0}>
              <table className="mkd-table" aria-labelledby={`${panelId}-results`}>
                <thead>
                  <tr>
                    <th scope="col">Channel / campaign</th>
                    <th scope="col">Spend</th>
                    <th scope="col">Leads</th>
                    <th scope="col">Cost per lead</th>
                    <th scope="col">Cost per qualified lead</th>
                    <th scope="col">Cost per opportunity</th>
                    <th scope="col">Closed won</th>
                    <th scope="col">Sales</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.map((id) => {
                    const r = byChannel[id];
                    const paid = id !== "blog";
                    const list = paid ? campaigns[id as PaidChannelId] : [];
                    const isOpen = Boolean(openChannels[id]);
                    const rowIds = list.map((_, i) => `${panelId}-${id}-${i}`).join(" ");
                    const action = paid
                      ? getAction({ name: channelName(id), ...r, spend: r.spend ?? 0 }, maxCpo)
                      : "Organic";
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
                                <span className="mkd-chevron" aria-hidden="true" />
                                {channelName(id)}
                                <span className="mkd-row-count">{list.length} campaigns</span>
                              </button>
                            ) : (
                              <span className="mkd-row-plain">
                                {channelName(id)}
                                <span className="mkd-row-count">Organic, no campaigns</span>
                              </span>
                            )}
                          </th>
                          <td>{r.spend === null ? NO_SPEND : money.format(r.spend)}</td>
                          <td>{count.format(r.leads)}</td>
                          <td>{costCell(r.spend, r.leads, benchLead)}</td>
                          <td>{costCell(r.spend, r.qualified, benchQualified)}</td>
                          <td>{costCell(r.spend, r.opportunities, maxCpo)}</td>
                          <td>{outcomeCell(count.format(r.closedWon), r.spend, r.closedWon)}</td>
                          <td>{outcomeCell(money.format(r.sales), r.spend, r.closedWon)}</td>
                          <td className="mkd-action">
                            <Status tone={ACTION_TONE[action]}>{ACTION_TEXT[action]}</Status>
                          </td>
                        </tr>
                        {list.map((c, i) => (
                          <tr key={c.name} id={`${panelId}-${id}-${i}`} className="mkd-row-campaign" hidden={!isOpen}>
                            <th scope="row" className="mkd-campaign-name">
                              {c.name}
                            </th>
                            <td>{money.format(c.spend)}</td>
                            <td>{count.format(c.leads)}</td>
                            <td>{costCell(c.spend, c.leads, benchLead)}</td>
                            <td>{costCell(c.spend, c.qualified, benchQualified)}</td>
                            <td>{costCell(c.spend, c.opportunities, maxCpo)}</td>
                            <td>{outcomeCell(count.format(c.closedWon), c.spend, c.closedWon)}</td>
                            <td>{outcomeCell(money.format(c.sales), c.spend, c.closedWon)}</td>
                            <td className="mkd-action">
                              <Status tone={ACTION_TONE[getAction(c, maxCpo)]}>{ACTION_TEXT[getAction(c, maxCpo)]}</Status>
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <p className="mkd-footnote">
            Cost metrics use paid channels only (Facebook, Instagram and YouTube). Blog has no paid spend, so its leads
            are excluded from cost per lead. Action: Scale at or under {Math.round(RULES.scaleBelowRatio * 100)}% of the
            maximum cost per opportunity, Pause above {Math.round(RULES.pauseAboveRatio * 100)}%, Too early under{" "}
            {RULES.minOpportunities} opportunities. Definitions of "qualified" and "opportunity" are pending
            confirmation.
          </p>
        </div>
      </main>
    </div>
  );
};

export default MarketingDashboard;
