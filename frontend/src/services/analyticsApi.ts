import { api } from "./api";
import type { ActivityEvent, AnalyticsOverview } from "../types/analytics";

export async function fetchAnalyticsOverview(days = 30) {
  const response = await api.get<AnalyticsOverview>("/analytics/overview", {
    params: { days },
  });
  return response.data;
}

export async function fetchRecentActivity(limit = 20) {
  const response = await api.get<{ activity: ActivityEvent[] }>("/analytics/activity", {
    params: { limit },
  });
  return response.data.activity;
}
