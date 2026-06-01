import { AxiosError } from "axios";
import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  FileText,
  Loader2,
  MessageSquareText,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { fetchAnalyticsOverview } from "../services/analyticsApi";
import type { ActivityEvent, AnalyticsOverview, ChartDatum } from "../types/analytics";
import { cn } from "../utils/cn";

const chartColors = ["#0f766e", "#2563eb", "#d97706", "#7c3aed", "#dc2626", "#059669"];
const rangeOptions = [7, 30, 90];

type TooltipItem = {
  name?: string;
  value?: string | number;
  color?: string;
};

type TooltipContentProps = {
  active?: boolean;
  label?: string | number;
  payload?: TooltipItem[];
};

function formatNumber(value: number | undefined) {
  return new Intl.NumberFormat().format(value ?? 0);
}

function formatPercent(value: number | undefined) {
  return `${(value ?? 0).toFixed(1)}%`;
}

function formatActivityDate(value?: string | null) {
  if (!value) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function hasChartData(data: ChartDatum[], keys: string[]) {
  return data.some((item) => keys.some((key) => Number(item[key] ?? 0) > 0));
}

function ChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-panel">
      {label ? <p className="mb-1 font-semibold text-foreground">{label}</p> : null}
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={`${item.name}-${item.value}`} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color ?? chartColors[0] }} />
            <span className="text-muted-foreground">{item.name}</span>
            <span className="font-semibold text-foreground">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full min-h-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
      No activity recorded for this range.
    </div>
  );
}

function ActivityList({ events }: { events: ActivityEvent[] }) {
  if (!events.length) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        Activity events will appear here as the workspace is used.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {events.map((event) => (
        <article key={event.id} className="flex items-start gap-3 py-3">
          <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
            <Activity size={16} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{event.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{formatActivityDate(event.createdAt)}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  index,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof BarChart3;
  index: number;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-lg border border-border bg-card p-5 shadow-panel"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-primary">
          <Icon size={20} aria-hidden="true" />
        </div>
        <TrendingUp size={18} className="text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </motion.article>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-28 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-80 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}

export function Analytics() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [days, setDays] = useState(30);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    fetchAnalyticsOverview(days)
      .then(setOverview)
      .catch((err) => {
        const message =
          err instanceof AxiosError
            ? err.response?.data?.message ?? "Could not load analytics"
            : "Could not load analytics";
        setError(message);
      })
      .finally(() => setIsLoading(false));
  }, [days]);

  const statCards = useMemo(() => {
    if (!overview) return [];
    return [
      {
        label: "Documents uploaded",
        value: formatNumber(overview.summary.documentsUploaded),
        detail: `${formatNumber(overview.summary.documentsIndexed)} indexed`,
        icon: FileText,
      },
      {
        label: "Leads extracted",
        value: formatNumber(overview.summary.leadsExtracted),
        detail: `${formatNumber(overview.leads.highConfidenceLeads)} high confidence`,
        icon: Target,
      },
      {
        label: "Chat questions",
        value: formatNumber(overview.summary.chatQuestionsAsked),
        detail: `${formatNumber(overview.conversations.questionsAskedInRange)} in range`,
        icon: MessageSquareText,
      },
      {
        label: "Active conversations",
        value: formatNumber(overview.summary.activeConversations),
        detail: `${formatNumber(overview.conversations.totalConversations)} total`,
        icon: Users,
      },
      {
        label: "Processing success",
        value: formatPercent(overview.summary.processingSuccessRate),
        detail: `${formatNumber(overview.documents.failedDocuments)} failed`,
        icon: CheckCircle2,
      },
      {
        label: "Engagement events",
        value: formatNumber(overview.recentActivity.length),
        detail: `${overview.range.days}-day window`,
        icon: Activity,
      },
    ];
  }, [overview]);

  if (isLoading && !overview) {
    return <AnalyticsSkeleton />;
  }

  if (!overview) {
    return (
      <section className="rounded-lg border border-border bg-card p-6 shadow-panel">
        <h2 className="text-xl font-semibold tracking-normal">Analytics</h2>
        <p className="mt-2 text-sm text-red-700">{error ?? "Could not load analytics"}</p>
      </section>
    );
  }

  const leadTrendHasData = hasChartData(overview.charts.leadGenerationTrend, ["leads"]);
  const documentTrendHasData = hasChartData(overview.charts.documentsProcessed, ["documents"]);
  const chatTrendHasData = hasChartData(overview.charts.chatActivity, ["questions"]);
  const engagementHasData = hasChartData(overview.charts.userEngagement, ["events"]);
  const sourceHasData = hasChartData(overview.charts.leadSourceDistribution, ["value"]);
  const statusHasData = hasChartData(overview.charts.documentStatusDistribution, ["value"]);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Workspace Analytics</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-normal">Performance and usage metrics</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {overview.range.startDate} to {overview.range.endDate}
            </p>
          </div>
          <div className="flex rounded-lg border border-border bg-background p-1">
            {rangeOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDays(option)}
                className={cn(
                  "h-9 rounded-md px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
                  days === option && "bg-muted text-foreground",
                )}
              >
                {option}d
              </button>
            ))}
          </div>
        </div>
      </section>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {statCards.map((card, index) => (
          <StatCard key={card.label} index={index} {...card} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-lg border border-border bg-card p-5 shadow-panel">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Lead generation trends</h3>
              <p className="mt-1 text-xs text-muted-foreground">Extracted leads by day</p>
            </div>
            {isLoading ? <Loader2 className="animate-spin text-muted-foreground" size={18} /> : null}
          </div>
          <div className="h-72">
            {leadTrendHasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={overview.charts.leadGenerationTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="leads" name="Leads" stroke={chartColors[0]} fill={chartColors[0]} fillOpacity={0.18} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </div>
        </article>

        <article className="rounded-lg border border-border bg-card p-5 shadow-panel">
          <div className="mb-5">
            <h3 className="text-sm font-semibold">Documents processed</h3>
            <p className="mt-1 text-xs text-muted-foreground">Indexed or failed documents by day</p>
          </div>
          <div className="h-72">
            {documentTrendHasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overview.charts.documentsProcessed}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="documents" name="Documents" fill={chartColors[1]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </div>
        </article>

        <article className="rounded-lg border border-border bg-card p-5 shadow-panel">
          <div className="mb-5">
            <h3 className="text-sm font-semibold">Chat activity</h3>
            <p className="mt-1 text-xs text-muted-foreground">User questions asked by day</p>
          </div>
          <div className="h-72">
            {chatTrendHasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={overview.charts.chatActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="questions" name="Questions" stroke={chartColors[2]} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </div>
        </article>

        <article className="rounded-lg border border-border bg-card p-5 shadow-panel">
          <div className="mb-5">
            <h3 className="text-sm font-semibold">User engagement</h3>
            <p className="mt-1 text-xs text-muted-foreground">Tracked workspace actions by day</p>
          </div>
          <div className="h-72">
            {engagementHasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={overview.charts.userEngagement}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="events" name="Events" stroke={chartColors[3]} fill={chartColors[3]} fillOpacity={0.16} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <article className="rounded-lg border border-border bg-card p-5 shadow-panel">
          <div className="mb-5">
            <h3 className="text-sm font-semibold">Lead source distribution</h3>
            <p className="mt-1 text-xs text-muted-foreground">Lead volume by indexed PDF</p>
          </div>
          <div className="h-72">
            {sourceHasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overview.charts.leadSourceDistribution} layout="vertical" margin={{ left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={150} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" name="Leads" fill={chartColors[4]} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </div>
        </article>

        <article className="rounded-lg border border-border bg-card p-5 shadow-panel">
          <div className="mb-5">
            <h3 className="text-sm font-semibold">Document status</h3>
            <p className="mt-1 text-xs text-muted-foreground">Current library state</p>
          </div>
          <div className="h-72">
            {statusHasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={overview.charts.documentStatusDistribution}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={3}
                  >
                    {overview.charts.documentStatusDistribution.map((entry, index) => (
                      <Cell key={entry.name ?? index} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <article className="rounded-lg border border-border bg-card p-5 shadow-panel">
          <h3 className="text-sm font-semibold">Processing quality</h3>
          <div className="mt-5 space-y-4">
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Success rate</span>
                <span className="font-semibold">{formatPercent(overview.documents.processingSuccessRate)}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${Math.min(overview.documents.processingSuccessRate, 100)}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-border p-3">
                <p className="text-muted-foreground">Processed</p>
                <p className="mt-1 text-lg font-semibold">{formatNumber(overview.documents.processedDocuments)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-muted-foreground">Failed</p>
                <p className="mt-1 text-lg font-semibold">{formatNumber(overview.documents.failedDocuments)}</p>
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-lg border border-border bg-card p-5 shadow-panel">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Recent activity</h3>
              <p className="mt-1 text-xs text-muted-foreground">Latest tracked events</p>
            </div>
            <Activity size={18} className="text-muted-foreground" aria-hidden="true" />
          </div>
          <ActivityList events={overview.recentActivity} />
        </article>
      </section>
    </div>
  );
}
