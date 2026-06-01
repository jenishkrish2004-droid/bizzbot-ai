export type DateRange = {
  days: number;
  startDate: string;
  endDate: string;
};

export type AnalyticsSummary = {
  documentsUploaded: number;
  documentsIndexed: number;
  leadsExtracted: number;
  chatQuestionsAsked: number;
  activeConversations: number;
  processingSuccessRate: number;
};

export type DocumentAnalytics = {
  totalDocuments: number;
  uploadedDocuments: number;
  processingDocuments: number;
  indexedDocuments: number;
  failedDocuments: number;
  processedDocuments: number;
  processingSuccessRate: number;
  statusDistribution: ChartDatum[];
};

export type LeadAnalytics = {
  totalLeads: number;
  highConfidenceLeads: number;
  companiesDetected: number;
  highConfidenceRate: number;
};

export type ConversationAnalytics = {
  totalConversations: number;
  activeConversations: number;
  questionsAsked: number;
  questionsAskedInRange: number;
};

export type ChartDatum = {
  name?: string;
  date?: string;
  label?: string;
  value?: number;
  leads?: number;
  documents?: number;
  questions?: number;
  events?: number;
  [key: string]: string | number | undefined;
};

export type ActivityEvent = {
  id: string;
  eventType: string;
  label: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata: Record<string, unknown>;
  createdAt?: string | null;
};

export type AnalyticsOverview = {
  range: DateRange;
  summary: AnalyticsSummary;
  documents: DocumentAnalytics;
  leads: LeadAnalytics;
  conversations: ConversationAnalytics;
  usageMetrics: Record<string, number>;
  charts: {
    leadGenerationTrend: ChartDatum[];
    documentsProcessed: ChartDatum[];
    chatActivity: ChartDatum[];
    userEngagement: ChartDatum[];
    leadSourceDistribution: ChartDatum[];
    documentStatusDistribution: ChartDatum[];
    usageMetricTotals: ChartDatum[];
  };
  recentActivity: ActivityEvent[];
};
