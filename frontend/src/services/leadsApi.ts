import { api } from "./api";
import type { Lead, LeadsResponse } from "../types/lead";

export type LeadQuery = {
  page?: number;
  perPage?: number;
  search?: string;
  company?: string;
};

export async function fetchLeads(query: LeadQuery = {}) {
  const response = await api.get<LeadsResponse>("/leads", { params: query });
  return response.data;
}

export async function fetchLead(leadId: string) {
  const response = await api.get<{ lead: Lead }>(`/leads/${leadId}`);
  return response.data.lead;
}

export async function deleteLead(leadId: string) {
  await api.delete(`/leads/${leadId}`);
}

export async function extractLeads(documentId: string, replaceExisting = false) {
  const response = await api.post<{ leads: Lead[]; count: number }>("/leads/extract", {
    documentId,
    replaceExisting,
  });
  return response.data;
}

export async function exportLeadsCsv() {
  const response = await api.get<Blob>("/leads/export/csv", { responseType: "blob" });
  return response.data;
}
