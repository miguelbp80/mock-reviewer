// Dashboard data for the marketing mock. Read from dashboard.json, which holds ASSUMED
// sample figures (see its _meta). No network calls.
// Channel totals are the sum of their campaigns. Blog is organic: no spend, no campaigns.
import raw from "./dashboard.json";

export type LineId = "hap" | "res";
export type PaidChannelId = "facebook" | "instagram" | "youtube";
export type ChannelId = PaidChannelId | "blog";

export type Metrics = {
  leads: number;
  qualified: number;
  sentToRes: number;
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
      sentToRes: acc.sentToRes + r.sentToRes,
      opportunities: acc.opportunities + r.opportunities,
      closedWon: acc.closedWon + r.closedWon,
      sales: acc.sales + r.sales,
    }),
    { leads: 0, qualified: 0, sentToRes: 0, opportunities: 0, closedWon: 0, sales: 0 },
  );

/*
 * The sample file only holds two windows (last 30 and last 90 days). Any other range
 * (today, this week, this month, a custom range) is ASSUMED: the nearest window is scaled by
 * days / window length. Real data will come from Salesforce by date, so this goes away then.
 */
const windowFor = (days: number) => (days <= 30 ? { key: "last30" as const, length: 30 } : { key: "last90" as const, length: 90 });

type RawLine = (typeof raw.lines)["hap"]["last30"];

const scaleCampaign = (line: LineId, c: CampaignRow, f: number): CampaignRow => {
  const leads = Math.round(c.leads * f);
  const closedWon = Math.round(c.closedWon * f);
  return {
    name: c.name,
    spend: Math.round(c.spend * f),
    leads,
    qualified: Math.min(Math.round(c.qualified * f), leads),
    sentToRes: Math.min(Math.round(c.sentToRes * f), leads),
    opportunities: Math.round(c.opportunities * f),
    closedWon,
    sales: closedWon * raw._meta.averageRevenuePerClosing[line],
  };
};

/** Campaign rows for one business line and a range of days, keyed by paid channel. */
export const getCampaigns = (line: LineId, days: number): Record<PaidChannelId, CampaignRow[]> => {
  const w = windowFor(days);
  const f = days / w.length;
  const p: RawLine = raw.lines[line][w.key];
  const scale = (list: CampaignRow[]) => list.map((c) => scaleCampaign(line, c, f));
  return {
    facebook: scale(p.facebook.campaigns),
    instagram: scale(p.instagram.campaigns),
    youtube: scale(p.youtube.campaigns),
  };
};

/** Channel-level rows, derived from campaigns for paid channels. */
export const getChannelRows = (line: LineId, days: number): Record<ChannelId, ChannelRow> => {
  const w = windowFor(days);
  const f = days / w.length;
  const campaigns = getCampaigns(line, days);
  const channelOf = (id: PaidChannelId): ChannelRow => {
    const list = campaigns[id];
    return { ...sumMetrics(list), spend: list.reduce((acc, c) => acc + c.spend, 0) };
  };
  const blog = scaleCampaign(line, { ...raw.lines[line][w.key].blog, name: "Blog", spend: 0 }, f);
  return {
    facebook: channelOf("facebook"),
    instagram: channelOf("instagram"),
    youtube: channelOf("youtube"),
    blog: { leads: blog.leads, qualified: blog.qualified, sentToRes: blog.sentToRes, opportunities: blog.opportunities, closedWon: blog.closedWon, sales: blog.sales, spend: null },
  };
};

export type MarketRow = {
  market: string;
  leads: number;
  qualified: number;
  sentToRes: number;
  opportunities: number;
  closedWon: number;
};

const MARKET_KEYS = ["leads", "qualified", "sentToRes", "opportunities", "closedWon"] as const;

/** Splits a total across weights so the parts add up exactly (largest remainder). */
const allocate = (total: number, weights: number[]): number[] => {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const exact = weights.map((w) => (w / sum) * total);
  const out = exact.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  exact
    .map((v, i) => ({ i, r: v - Math.floor(v) }))
    .sort((a, b) => b.r - a.r)
    .forEach(({ i }) => {
      if (left > 0) {
        out[i] += 1;
        left -= 1;
      }
    });
  return out;
};

/**
 * Leads by market, adding up to the all-channels totals of the same range.
 * TODO: ZIP to market mapping is pending (needs the reference sheet); market shares come from a pre-aggregated block.
 */
export const getMarkets = (line: LineId, days: number): MarketRow[] => {
  const base = raw.markets[line][windowFor(days).key] as MarketRow[];
  const rows = getChannelRows(line, days);
  const total = sumMetrics(Object.values(rows));
  const parts = Object.fromEntries(
    MARKET_KEYS.map((k) => [k, allocate(total[k], base.map((m) => m[k]))]),
  ) as Record<(typeof MARKET_KEYS)[number], number[]>;
  return base.map((m, i) => ({
    market: m.market,
    leads: parts.leads[i],
    qualified: parts.qualified[i],
    sentToRes: parts.sentToRes[i],
    opportunities: parts.opportunities[i],
    closedWon: parts.closedWon[i],
  }));
};

export const getTests = (line: LineId): Test[] => raw.tests[line] as Test[];

export const getReactivation = (line: LineId): Record<string, number> => raw.reactivation[line];
