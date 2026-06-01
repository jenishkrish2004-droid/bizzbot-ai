import { Copy, ExternalLink, X } from "lucide-react";
import { motion } from "framer-motion";

import type { Lead } from "../../types/lead";

type LeadDetailsModalProps = {
  lead: Lead | null;
  onClose: () => void;
  onToast: (message: string) => void;
};

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium">{value || "Not detected"}</dd>
    </div>
  );
}

function CopyButton({ value, onToast }: { value?: string | null; onToast: (message: string) => void }) {
  if (!value) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value);
        onToast("Copied to clipboard");
      }}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
      aria-label="Copy value"
    >
      <Copy size={15} aria-hidden="true" />
    </button>
  );
}

export function LeadDetailsModal({ lead, onClose, onToast }: LeadDetailsModalProps) {
  if (!lead) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
      <motion.section
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="glass-panel-strong max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-lg"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Lead Details</p>
            <h2 className="mt-1 text-xl font-semibold tracking-normal">{lead.name || lead.email || "Untitled lead"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Close lead details"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[calc(90vh-5rem)] overflow-y-auto px-5 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="glass-panel rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <Field label="Email" value={lead.email} />
                <CopyButton value={lead.email} onToast={onToast} />
              </div>
            </div>
            <div className="glass-panel rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <Field label="Phone" value={lead.phone} />
                <CopyButton value={lead.phone} onToast={onToast} />
              </div>
            </div>
            <Field label="Company" value={lead.company} />
            <Field label="Designation" value={lead.designation} />
            <Field label="Location" value={lead.location} />
            <Field label="Confidence" value={`${Math.round(lead.confidenceScore * 100)}%`} />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="glass-panel rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <Field label="Website" value={lead.website} />
                {lead.website ? (
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label="Open website"
                  >
                    <ExternalLink size={15} aria-hidden="true" />
                  </a>
                ) : null}
              </div>
            </div>
            <div className="glass-panel rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <Field label="LinkedIn" value={lead.linkedin} />
                {lead.linkedin ? (
                  <a
                    href={lead.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label="Open LinkedIn"
                  >
                    <ExternalLink size={15} aria-hidden="true" />
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          <div className="glass-panel mt-5 rounded-lg p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Intent Keywords</dt>
            <dd className="mt-3 flex flex-wrap gap-2">
              {lead.intent.length ? (
                lead.intent.map((intent) => (
                  <span key={intent} className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                    {intent}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No intent keywords detected</span>
              )}
            </dd>
          </div>

          <div className="glass-panel mt-5 rounded-lg p-4">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Extracted Source Text</dt>
              <CopyButton value={lead.sourceText} onToast={onToast} />
            </div>
            <dd className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {lead.sourceText || "No source text stored."}
            </dd>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
