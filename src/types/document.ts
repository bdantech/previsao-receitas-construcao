
export interface DocumentType {
  id: string;
  name: string;
  description?: string;
  required?: boolean;
}

export interface CompanyDocument {
  id: string;
  document_type: DocumentType;
  status: "not_sent" | "sent" | "approved" | "needs_revision" | "rejected";
  file_name: string;
  file_path: string;
  review_notes?: string;
  submitted_at?: string;
  submitted_by?: { id: string; email: string };
  reviewed_at?: string;
  reviewer?: { id: string; email: string };
}
