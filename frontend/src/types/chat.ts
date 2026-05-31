export type Citation = {
  source: number;
  documentId: string;
  documentName: string;
  page?: number | null;
  chunkIndex?: number | null;
  score?: number | null;
  preview: string;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  createdAt: string;
};

export type Conversation = {
  id: string;
  documentId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages?: ChatMessage[];
};
