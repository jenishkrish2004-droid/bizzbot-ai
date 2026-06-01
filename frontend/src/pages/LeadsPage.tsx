import { AxiosError } from "axios";
import { motion } from "framer-motion";
import {
  Building2,
  Download,
  Eye,
  Filter,
  Loader2,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { LeadDetailsModal } from "../components/leads/LeadDetailsModal";
import { Button } from "../components/ui/button";
import {
  deleteLead,
  exportLeadsCsv,
  extractLeads,
  fetchLeads,
} from "../services/leadsApi";
import { api } from "../services/api";
import type { DocumentRecord } from "../types/document";
import type { Lead, LeadsResponse, LeadsSummary } from "../types/lead";
import { cn } from "../utils/cn";

const defaultSummary: LeadsSummary = {
  totalLeads: 0,
  highConfidenceLeads: 0,
  companiesDetected: 0,
  recentExtractions: [],
};

function confidenceTone(score: number) {
  if (score >= 0.75) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (score >= 0.5) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function SkeletonRows() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="grid gap-3 px-4 py-4 md:grid-cols-[1.3fr_1fr_1fr_120px_90px]">
          {Array.from({ length: 5 }).map((__, cellIndex) => (
            <div key={cellIndex} className="h-5 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [summary, setSummary] = useState<LeadsSummary>(defaultSummary);
  const [companies, setCompanies] = useState<string[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [search, setSearch] = useState("");
  const [company, setCompany] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const indexedDocuments = useMemo(
    () => documents.filter((document) => document.status === "indexed"),
    [documents],
  );

  useEffect(() => {
    void loadLeads();
  }, [page, company]);

  useEffect(() => {
    api
      .get<{ documents: DocumentRecord[] }>("/documents")
      .then((response) => {
        setDocuments(response.data.documents);
        const firstIndexed = response.data.documents.find((document) => document.status === "indexed");
        if (firstIndexed) setSelectedDocumentId(firstIndexed.id);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function loadLeads(nextSearch = search) {
    setIsLoading(true);
    setError(null);
    try {
      const data: LeadsResponse = await fetchLeads({
        page,
        perPage: 12,
        search: nextSearch || undefined,
        company: company || undefined,
      });
      setLeads(data.leads);
      setSummary(data.summary);
      setCompanies(data.companies);
      setPages(Math.max(data.pagination.pages, 1));
    } catch (err) {
      setError(err instanceof AxiosError ? err.response?.data?.message ?? "Could not load leads" : "Could not load leads");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleExtract() {
    if (!selectedDocumentId) {
      setError("Select an indexed document first");
      return;
    }

    setIsExtracting(true);
    setError(null);
    try {
      const result = await extractLeads(selectedDocumentId);
      setToast(`Extracted ${result.count} lead${result.count === 1 ? "" : "s"}`);
      setPage(1);
      await loadLeads("");
    } catch (err) {
      setError(err instanceof AxiosError ? err.response?.data?.message ?? "Could not extract leads" : "Could not extract leads");
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleDelete(leadId: string) {
    setError(null);
    try {
      await deleteLead(leadId);
      setToast("Lead deleted");
      await loadLeads();
    } catch (err) {
      setError(err instanceof AxiosError ? err.response?.data?.message ?? "Could not delete lead" : "Could not delete lead");
    }
  }

  async function handleExport() {
    setIsExporting(true);
    setError(null);
    try {
      const blob = await exportLeadsCsv();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "bizzbot-leads.csv";
      link.click();
      URL.revokeObjectURL(url);
      setToast("CSV export ready");
    } catch (err) {
      setError(err instanceof AxiosError ? err.response?.data?.message ?? "Could not export leads" : "Could not export leads");
    } finally {
      setIsExporting(false);
    }
  }

  function handleSearchSubmit() {
    setPage(1);
    void loadLeads(search);
  }

  const cards = [
    { label: "Total leads", value: summary.totalLeads, icon: Users },
    { label: "High confidence", value: summary.highConfidenceLeads, icon: Sparkles },
    { label: "Companies", value: summary.companiesDetected, icon: Building2 },
    { label: "Recent", value: summary.recentExtractions.length, icon: Filter },
  ];

  return (
    <div className="space-y-6">
      {toast ? (
        <div className="glass-panel-strong fixed right-4 top-4 z-50 rounded-lg px-4 py-3 text-sm font-medium">
          {toast}
        </div>
      ) : null}

      <section className="glass-panel-strong rounded-lg p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Lead Engine</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-normal">AI-extracted prospects</h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              className="field-control min-w-64"
              value={selectedDocumentId}
              onChange={(event) => setSelectedDocumentId(event.target.value)}
              disabled={!indexedDocuments.length}
            >
              {indexedDocuments.length ? (
                indexedDocuments.map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.originalFilename}
                  </option>
                ))
              ) : (
                <option value="">No indexed documents</option>
              )}
            </select>
            <Button type="button" onClick={handleExtract} disabled={isExtracting || !selectedDocumentId}>
              {isExtracting ? <Loader2 className="mr-2 animate-spin" size={18} /> : <Sparkles className="mr-2" size={18} />}
              Extract
            </Button>
            <Button type="button" variant="secondary" onClick={handleExport} disabled={isExporting || !summary.totalLeads}>
              {isExporting ? <Loader2 className="mr-2 animate-spin" size={18} /> : <Download className="mr-2" size={18} />}
              Export CSV
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {cards.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="glass-panel interactive-card rounded-lg p-5"
          >
            <card.icon size={20} className="text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold">{card.value}</p>
          </motion.div>
        ))}
      </section>

      <section className="glass-panel-strong rounded-lg">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
              <input
                className="field-control h-10 pl-9 pr-3"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSearchSubmit();
                }}
                placeholder="Search name, company, email, location..."
              />
            </div>
            <Button type="button" variant="secondary" onClick={handleSearchSubmit}>
              Search
            </Button>
          </div>
          <select
            className="field-control h-10"
            value={company}
            onChange={(event) => {
              setCompany(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All companies</option>
            {companies.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        {error ? <p className="error-alert mx-4 mt-4 rounded-md px-3 py-2 text-sm">{error}</p> : null}

        <div className="overflow-x-auto">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-[1.3fr_1fr_1fr_120px_100px] gap-3 border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Lead</span>
              <span>Company</span>
              <span>Intent</span>
              <span>Confidence</span>
              <span>Actions</span>
            </div>
            {isLoading ? (
              <SkeletonRows />
            ) : leads.length ? (
              <div className="divide-y divide-border">
                {leads.map((lead) => (
                  <article key={lead.id} className="grid grid-cols-[1.3fr_1fr_1fr_120px_100px] gap-3 px-4 py-4 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{lead.name || lead.email || lead.phone || "Unnamed lead"}</p>
                      <p className="mt-1 truncate text-muted-foreground">{lead.email || lead.phone || "No contact detected"}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{lead.company || "Unknown"}</p>
                      <p className="mt-1 truncate text-muted-foreground">{lead.designation || lead.location || "No role data"}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {lead.intent.length ? (
                        lead.intent.slice(0, 3).map((intent) => (
                          <span key={intent} className="status-pill">
                            {intent}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </div>
                    <div>
                      <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold", confidenceTone(lead.confidenceScore))}>
                        {Math.round(lead.confidenceScore * 100)}%
                      </span>
                      <p className="mt-2 text-xs text-muted-foreground">{formatDate(lead.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedLead(lead)}
                        className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        aria-label="View lead"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(lead.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        aria-label="Delete lead"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="px-4 py-16 text-center">
                <Users className="mx-auto text-muted-foreground" size={34} />
                <h3 className="mt-4 text-lg font-semibold tracking-normal">No leads yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Index a PDF, then run extraction from this dashboard.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Page {page} of {pages}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              Previous
            </Button>
            <Button type="button" variant="secondary" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>
              Next
            </Button>
          </div>
        </div>
      </section>

      <LeadDetailsModal lead={selectedLead} onClose={() => setSelectedLead(null)} onToast={setToast} />
    </div>
  );
}
