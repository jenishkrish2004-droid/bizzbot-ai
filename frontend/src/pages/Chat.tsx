import { AxiosError } from "axios";
import { Bot, FileText, Loader2, MessageSquareText, SendHorizontal } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "../components/ui/button";
import { api } from "../services/api";
import type { Conversation } from "../types/chat";
import type { DocumentRecord } from "../types/document";
import { cn } from "../utils/cn";

export function Chat() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState("");
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const indexedDocuments = useMemo(
    () => documents.filter((document) => document.status === "indexed"),
    [documents],
  );

  useEffect(() => {
    Promise.all([
      api.get<{ documents: DocumentRecord[] }>("/documents"),
      api.get<{ conversations: Conversation[] }>("/chat/conversations"),
    ])
      .then(([documentsResponse, conversationsResponse]) => {
        setDocuments(documentsResponse.data.documents);
        setConversations(conversationsResponse.data.conversations);
        const firstIndexed = documentsResponse.data.documents.find((document) => document.status === "indexed");
        if (firstIndexed) {
          setActiveDocumentId(firstIndexed.id);
        }
      })
      .catch((err) => {
        const message =
          err instanceof AxiosError
            ? err.response?.data?.message ?? "Could not load chat workspace"
            : "Could not load chat workspace";
        setError(message);
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function loadConversation(conversationId: string) {
    setError(null);
    try {
      const response = await api.get<{ conversation: Conversation }>(
        `/chat/conversations/${conversationId}`,
      );
      setActiveConversation(response.data.conversation);
      setActiveDocumentId(response.data.conversation.documentId);
    } catch (err) {
      const message =
        err instanceof AxiosError
          ? err.response?.data?.message ?? "Could not load conversation"
          : "Could not load conversation";
      setError(message);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeDocumentId || !question.trim()) {
      return;
    }

    const submittedQuestion = question.trim();
    setQuestion("");
    setError(null);
    setIsSending(true);

    try {
      const response = await api.post<{ conversation: Conversation }>("/chat/ask", {
        documentId: activeDocumentId,
        conversationId: activeConversation?.id,
        question: submittedQuestion,
      });
      setActiveConversation(response.data.conversation);
      setConversations((current) => {
        const exists = current.some((conversation) => conversation.id === response.data.conversation.id);
        if (exists) {
          return current.map((conversation) =>
            conversation.id === response.data.conversation.id ? response.data.conversation : conversation,
          );
        }
        return [response.data.conversation, ...current];
      });
    } catch (err) {
      setQuestion(submittedQuestion);
      const message =
        err instanceof AxiosError
          ? err.response?.data?.message ?? "Could not send message"
          : "Could not send message";
      setError(message);
    } finally {
      setIsSending(false);
    }
  }

  const activeDocument = documents.find((document) => document.id === activeDocumentId);

  return (
    <div className="grid min-h-[calc(100vh-9rem)] gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="rounded-lg border border-border bg-card p-5 shadow-panel">
        <div>
          <p className="text-sm font-medium text-muted-foreground">RAG Workspace</p>
          <h2 className="mt-1 text-xl font-semibold tracking-normal">Document Chat</h2>
        </div>

        <label className="mt-5 block text-sm font-medium">
          Indexed document
          <select
            className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            value={activeDocumentId}
            onChange={(event) => {
              setActiveDocumentId(event.target.value);
              setActiveConversation(null);
            }}
            disabled={!indexedDocuments.length}
          >
            {indexedDocuments.length ? (
              indexedDocuments.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.originalFilename}
                </option>
              ))
            ) : (
              <option value="">No indexed PDFs</option>
            )}
          </select>
        </label>

        {activeDocument ? (
          <div className="mt-4 rounded-lg border border-border bg-background p-3">
            <div className="flex items-start gap-3">
              <FileText size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{activeDocument.originalFilename}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {activeDocument.chunkCount} chunks · {activeDocument.textCharCount.toLocaleString()} chars
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-6">
          <h3 className="text-sm font-semibold">Conversations</h3>
          <div className="mt-3 space-y-2">
            {conversations.length ? (
              conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => loadConversation(conversation.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md border border-border px-3 py-2 text-left text-sm transition hover:bg-muted",
                    activeConversation?.id === conversation.id && "bg-muted",
                  )}
                >
                  <MessageSquareText size={16} className="shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 truncate">{conversation.title}</span>
                </button>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                Ask a question to start a conversation.
              </p>
            )}
          </div>
        </div>
      </aside>

      <section className="flex min-h-[620px] flex-col rounded-lg border border-border bg-card shadow-panel">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {activeDocument ? activeDocument.originalFilename : "No indexed document selected"}
            </p>
            <h2 className="text-xl font-semibold tracking-normal">Ask against your PDF</h2>
          </div>
          {isLoading ? <Loader2 className="animate-spin text-muted-foreground" size={20} aria-hidden="true" /> : null}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {activeConversation?.messages?.length ? (
            activeConversation.messages.map((message) => (
              <article
                key={message.id}
                className={cn(
                  "max-w-3xl rounded-lg px-4 py-3",
                  message.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "border border-border bg-background",
                )}
              >
                <div className="flex items-start gap-3">
                  {message.role === "assistant" ? (
                    <Bot size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                    {message.citations.length ? (
                      <div className="mt-4 space-y-2">
                        {message.citations.map((citation) => (
                          <div key={`${message.id}-${citation.source}`} className="rounded-md bg-muted px-3 py-2">
                            <p className="text-xs font-semibold text-foreground">
                              Source {citation.source}
                              {citation.page ? ` · Page ${citation.page}` : ""}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{citation.preview}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="max-w-md text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-muted text-primary">
                  <Bot size={26} aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-lg font-semibold tracking-normal">Ask a document-aware question</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Index a PDF from Upload, select it here, then ask for summaries, risks, leads, or business signals.
                </p>
              </div>
            </div>
          )}
        </div>

        {error ? <p className="mx-5 mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        <form className="border-t border-border p-4" onSubmit={handleSubmit}>
          <div className="flex gap-3">
            <input
              className="h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about this document..."
              disabled={!activeDocumentId || isSending}
            />
            <Button type="submit" disabled={!activeDocumentId || !question.trim() || isSending}>
              {isSending ? (
                <Loader2 className="mr-2 animate-spin" size={18} aria-hidden="true" />
              ) : (
                <SendHorizontal className="mr-2" size={18} aria-hidden="true" />
              )}
              Send
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
