export type DocumentRecord = {
  id: string;
  originalFilename: string;
  storedFilename: string;
  contentType: string;
  fileSizeBytes: number;
  status: string;
  textCharCount: number;
  chunkCount: number;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
};
