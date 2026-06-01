import { AxiosError } from "axios";
import { CheckCircle2, FileText, FileUp, Loader2, Trash2, X } from "lucide-react";
import { type ChangeEvent, type DragEvent, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "../components/ui/button";
import { api } from "../services/api";
import type { DocumentRecord } from "../types/document";
import { cn } from "../utils/cn";

const maxFileSizeMb = 25;

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function mergeFiles(current: File[], incoming: File[]) {
  const seen = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
  const next = [...current];

  for (const file of incoming) {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (!seen.has(key)) {
      next.push(file);
      seen.add(key);
    }
  }

  return next;
}

export function Upload() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [processingDocumentId, setProcessingDocumentId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const selectedSize = useMemo(
    () => selectedFiles.reduce((total, file) => total + file.size, 0),
    [selectedFiles],
  );

  useEffect(() => {
    api
      .get<{ documents: DocumentRecord[] }>("/documents")
      .then((response) => setDocuments(response.data.documents))
      .catch((err) => {
        const message =
          err instanceof AxiosError
            ? err.response?.data?.message ?? "Could not load documents"
            : "Could not load documents";
        setError(message);
      })
      .finally(() => setIsLoading(false));
  }, []);

  function validateClientFiles(files: File[]) {
    const maxBytes = maxFileSizeMb * 1024 * 1024;
    const invalid = files.find((file) => file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"));
    if (invalid) {
      throw new Error(`${invalid.name} is not a PDF`);
    }

    const oversized = files.find((file) => file.size > maxBytes);
    if (oversized) {
      throw new Error(`${oversized.name} exceeds ${maxFileSizeMb}MB`);
    }
  }

  function addFiles(files: File[]) {
    try {
      setError(null);
      validateClientFiles(files);
      setSelectedFiles((current) => mergeFiles(current, files));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add files");
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  }

  function removeSelectedFile(fileToRemove: File) {
    setSelectedFiles((current) => current.filter((file) => file !== fileToRemove));
  }

  async function handleUpload() {
    if (!selectedFiles.length) {
      setError("Select at least one PDF");
      return;
    }

    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append("files", file));

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const response = await api.post<{ documents: DocumentRecord[] }>("/documents/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          if (event.total) {
            setUploadProgress(Math.round((event.loaded * 100) / event.total));
          }
        },
      });
      setDocuments((current) => [...response.data.documents, ...current]);
      setSelectedFiles([]);
      setUploadProgress(100);
    } catch (err) {
      const message =
        err instanceof AxiosError
          ? err.response?.data?.message ?? "Upload failed"
          : "Upload failed";
      setError(message);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(documentId: string) {
    setError(null);
    try {
      await api.delete(`/documents/${documentId}`);
      setDocuments((current) => current.filter((document) => document.id !== documentId));
    } catch (err) {
      const message =
        err instanceof AxiosError
          ? err.response?.data?.message ?? "Could not delete document"
          : "Could not delete document";
      setError(message);
    }
  }

  async function handleProcess(documentId: string) {
    setError(null);
    setProcessingDocumentId(documentId);

    try {
      const response = await api.post<{ document: DocumentRecord }>(
        `/documents/${documentId}/process`,
        {},
        { timeout: 120000 },
      );
      setDocuments((current) =>
        current.map((document) => (document.id === documentId ? response.data.document : document)),
      );
    } catch (err) {
      const message =
        err instanceof AxiosError
          ? err.response?.data?.message ?? "Could not index document"
          : "Could not index document";
      setError(message);
    } finally {
      setProcessingDocumentId(null);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="glass-panel-strong rounded-lg p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Document Intake</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-normal">Upload PDF knowledge sources</h2>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
          >
            <FileUp className="mr-2" size={18} aria-hidden="true" />
            Select PDFs
          </Button>
        </div>

        <input
          ref={inputRef}
          className="hidden"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          onChange={handleFileChange}
        />

        <div
          className={cn(
            "mt-6 flex min-h-60 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background/65 px-6 py-10 text-center transition",
            isDragging && "border-primary bg-muted/80 shadow-glow",
          )}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted text-primary">
            <FileUp size={26} aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-lg font-semibold tracking-normal">Drop PDFs here</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Upload up to 10 files at a time. Each PDF can be up to {maxFileSizeMb}MB.
          </p>
        </div>

        {error ? (
          <div className="error-alert mt-4 flex items-center gap-2 rounded-md px-3 py-2 text-sm">
            <X size={16} aria-hidden="true" />
            {error}
          </div>
        ) : null}

        <div className="glass-panel mt-6 rounded-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold">Selected Files</h3>
              <p className="text-xs text-muted-foreground">
                {selectedFiles.length} file{selectedFiles.length === 1 ? "" : "s"} / {formatBytes(selectedSize)}
              </p>
            </div>
            <Button type="button" onClick={handleUpload} disabled={!selectedFiles.length || isUploading}>
              {isUploading ? <Loader2 className="mr-2 animate-spin" size={18} aria-hidden="true" /> : null}
              {isUploading ? `Uploading ${uploadProgress}%` : "Upload"}
            </Button>
          </div>

          <div className="divide-y divide-border">
            {selectedFiles.length ? (
              selectedFiles.map((file) => (
                <div key={`${file.name}-${file.lastModified}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-muted/45">
                  <FileText size={20} className="shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSelectedFile(file)}
                    className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              ))
            ) : (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No PDFs selected yet.</p>
            )}
          </div>
        </div>
      </section>

      <section className="glass-panel-strong rounded-lg p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Library</p>
            <h2 className="mt-1 text-xl font-semibold tracking-normal">Uploaded PDFs</h2>
          </div>
          {isLoading ? <Loader2 className="animate-spin text-muted-foreground" size={20} aria-hidden="true" /> : null}
        </div>

        <div className="mt-5 space-y-3">
          {documents.length ? (
            documents.map((document) => (
              <article key={document.id} className="interactive-card rounded-lg border border-border/80 bg-background/45 p-4">
                <div className="flex items-start gap-3">
                  <FileText size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{document.originalFilename}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatBytes(document.fileSizeBytes)}</span>
                      <span>/</span>
                      <span>{formatDate(document.createdAt)}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <div className="status-pill">
                        <CheckCircle2
                          size={14}
                          className={document.status === "failed" ? "text-red-600" : "text-emerald-600"}
                          aria-hidden="true"
                        />
                        {document.status}
                      </div>
                      {document.status === "indexed" ? (
                        <span className="status-pill">
                          {document.chunkCount} chunks
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {document.status !== "indexed" ? (
                    <button
                      type="button"
                      onClick={() => handleProcess(document.id)}
                      disabled={processingDocumentId === document.id}
                      className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-60"
                    >
                      {processingDocumentId === document.id ? (
                        <Loader2 className="animate-spin" size={15} aria-hidden="true" />
                      ) : (
                        <FileUp size={15} aria-hidden="true" />
                      )}
                      Index
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleDelete(document.id)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label={`Delete ${document.originalFilename}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Uploaded documents will appear here.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
