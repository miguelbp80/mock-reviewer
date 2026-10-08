// Dashboard data for the marketing mock. Read from dashboard.json, which holds ASSUMED
// sample figures (see its _meta). No network calls.
// Channel totals are the sum of their campaigns. Blog is organic: no spend, no campaigns.
import raw from "./dashboard.json";

export type LineId = "hap" | "res";
export type PeriodId = "last30" | "last90";
export type PaidChannelId = "facebook" | "instagram" | "youtube";
export type ChannelId = PaidChannelId | "blog";

export type Metrics = {
  leads: number;
  qualified: number;
  opportunities: number;
  closedWon: number;
  sales: number;
};

export type CampaignRow = Metrics & { name: string; spend: number };

export type ChannelRow = Metrics & { spend: number | null };

export type Action = "Scale" | "Keep" | "Pause" | "Too early" | "Organic";

export type Test = {
  channel: ChannelId;
  method: string;
  period: string;
  metric: string;
  result: string;
  confidence: string;
  decision: string;
};

export const LINES: { id: LineId; label: string }[] = [
  { id: "hap", label: "HAP" },
  { id: "res", label: "RES" },
];

export const PERIODS: { id: PeriodId; label: string }[] = [
  { id: "last30", label: raw._meta.periods.last30 },
  { id: "last90", label: raw._meta.periods.last90 },
];

export const CHANNELS: { id: ChannelId; label: string; paid: boolean }[] = [
  { id: "facebook", label: "Facebook", paid: true },
  { id: "instagram", label: "Instagram", paid: true },
  { id: "youtube", label: "YouTube", paid: true },
  { id: "blog", label: "Blog", paid: false },
];

export const RULES = raw.rules;

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

type RawPeriod = (typeof raw.lines)["hap"]["last30"];

const rawPeriod = (line: LineId, period: PeriodId): RawPeriod => raw.lines[line][period];

/** Campaign rows for one business line and period, keyed by paid channel. */
export const getCampaigns = (line: LineId, period: PeriodId): Record<PaidChannelId, CampaignRow[]> => {
  const p = rawPeriod(line, period);
  return {
    facebook: p.facebook.campaigns,
    instagram: p.instagram.campaigns,
    youtube: p.youtube.campaigns,
  };
};

/** Channel-level rows for one business line and period, derived from campaigns for paid channels. */
export const getChannelRows = (line: LineId, period: PeriodId): Record<ChannelId, ChannelRow> => {
  const campaigns = getCampaigns(line, period);
  const channelOf = (id: PaidChannelId): ChannelRow => {
    const list = campaigns[id];
    return { ...sumMetrics(list), spend: list.reduce((acc, c) => acc + c.spend, 0) };
  };
  return {
    facebook: channelOf("facebook"),
    instagram: channelOf("instagram"),
    youtube: channelOf("youtube"),
    blog: rawPeriod(line, period).blog,
  };
};

/** Maximum cost per opportunity: revenue per opportunity x target marketing share. */
export const getMaxCostPerOpportunity = (line: LineId, period: PeriodId): number | null => {
  const rows = Object.values(getChannelRows(line, period));
  const total = sumMetrics(rows);
  if (!total.opportunities) return null;
  return (total.sales / total.opportunities) * RULES.targetMarketingShare;
};

/** Marketing efficiency: total revenue / total marketing spend (blog spend is zero). */
export const getEfficiency = (line: LineId, period: PeriodId): number | null => {
  const rows = Object.values(getChannelRows(line, period));
  const total = sumMetrics(rows);
  const spend = rows.reduce((acc, r) => acc + (r.spend ?? 0), 0);
  return spend ? total.sales / spend : null;
};

/** Decision for one campaign, from its cost per opportunity against the line's maximum. */
export const getAction = (c: CampaignRow, maxCpo: number | null): Action => {
  if (maxCpo === null || c.opportunities < RULES.minOpportunities) return "Too early";
  const cpo = c.spend / c.opportunities;
  if (cpo <= maxCpo * RULES.scaleBelowRatio) return "Scale";
  if (cpo > maxCpo * RULES.pauseAboveRatio) return "Pause";
  return "Keep";
};

export const getTests = (line: LineId): Test[] => raw.tests[line] as Test[];

export const getReactivation = (line: LineId): Record<string, number> => raw.reactivation[line];
