
import { supabase } from "./client";
import { Session } from "@supabase/supabase-js";

export type DocumentType = {
  id: string;
  name: string;
  resource: string;
  description: string | null;
  required: boolean;
  created_at: string;
  updated_at: string;
};

export type DocumentStatus = 'sent' | 'approved' | 'needs_revision';

export type Document = {
  id: string;
  document_type_id: string;
  resource_type: string;
  resource_id: string;
  status: DocumentStatus;
  file_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  submitted_by: string;
  reviewed_by: string | null;
  review_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  document_type?: DocumentType;
  submitter?: { id: string; email: string };
  reviewer?: { id: string; email: string } | null;
};

export type DocumentFilter = {
  resourceType?: string;
  resourceId?: string;
  status?: DocumentStatus;
};

// Generate the URL for the document management edge function
const getDocumentManagementUrl = (endpoint: string, params?: Record<string, string>) => {
  const url = new URL(`${supabase.functions.url}/document-management/${endpoint}`);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        url.searchParams.append(key, value);
      }
    });
  }
  
  return url.toString();
};

// Function to fetch all document types
export const getDocumentTypes = async (session: Session) => {
  const response = await fetch(getDocumentManagementUrl('document-types'), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch document types');
  }

  const data = await response.json();
  return data.documentTypes as DocumentType[];
};

// Function to create a new document type (admin only)
export const createDocumentType = async (
  session: Session, 
  documentType: { name: string; resource: string; description?: string; required?: boolean }
) => {
  const response = await fetch(getDocumentManagementUrl('document-types'), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(documentType)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to create document type');
  }

  const data = await response.json();
  return data.documentType as DocumentType;
};

// Function to fetch documents with optional filters
export const getDocuments = async (session: Session, filters?: DocumentFilter) => {
  const params: Record<string, string> = {};
  
  if (filters) {
    if (filters.resourceType) params.resourceType = filters.resourceType;
    if (filters.resourceId) params.resourceId = filters.resourceId;
    if (filters.status) params.status = filters.status;
  }
  
  const response = await fetch(getDocumentManagementUrl('documents', params), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch documents');
  }

  const data = await response.json();
  return data.documents as Document[];
};

// Function to submit a new document
export const submitDocument = async (
  session: Session,
  document: {
    documentTypeId: string;
    resourceType: string;
    resourceId: string;
    filePath: string;
    fileName: string;
    fileSize?: number;
    mimeType?: string;
  }
) => {
  const response = await fetch(getDocumentManagementUrl('documents'), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(document)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to submit document');
  }

  const data = await response.json();
  return data.document as Document;
};

// Function to update document status (admin approves/rejects, user resubmits)
export const updateDocumentStatus = async (
  session: Session,
  id: string,
  status: DocumentStatus,
  reviewNotes?: string
) => {
  const response = await fetch(getDocumentManagementUrl('documents'), {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ id, status, reviewNotes })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to update document status');
  }

  const data = await response.json();
  return data.document as Document;
};

// Function to upload a file to storage
export const uploadDocumentFile = async (
  session: Session,
  resourceType: string,
  resourceId: string,
  file: File
) => {
  // Create a path in the format: resourceType/resourceId/timestamp-filename
  const timestamp = new Date().getTime();
  const filePath = `${resourceType}/${resourceId}/${timestamp}-${file.name}`;
  
  const { data, error } = await supabase.storage
    .from('documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });
  
  if (error) {
    throw new Error(`Error uploading file: ${error.message}`);
  }
  
  return {
    filePath,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type
  };
};

// Function to get a public URL for a document
export const getDocumentUrl = (filePath: string) => {
  const { data } = supabase.storage
    .from('documents')
    .getPublicUrl(filePath);
  
  return data.publicUrl;
};
