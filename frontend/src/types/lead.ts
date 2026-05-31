export type Lead = {
  id: string;
  userId: string;
  documentId?: string | null;
  documentName?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  designation?: string | null;
  location?: string | null;
  website?: string | null;
  linkedin?: string | null;
  intent: string[];
  confidenceScore: number;
  sourceText?: string | null;
  createdAt: string;
};

export type LeadsSummary = {
  totalLeads: number;
  highConfidenceLeads: number;
  companiesDetected: number;
  recentExtractions: Lead[];
};

export type LeadsPagination = {
  page: number;
  perPage: number;
  total: number;
  pages: number;
};

export type LeadsResponse = {
  leads: Lead[];
  pagination: LeadsPagination;
  summary: LeadsSummary;
  companies: string[];
};
