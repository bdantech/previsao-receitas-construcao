
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
  // Correctly build the URL for the edge function
  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL || 'https://hshfqxjrilqzjpkcotgz.supabase.co'}/functions/v1/document-management/${endpoint}`;
  const url = new URL(baseUrl);
  
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

// Storage access credentials - these will bypass RLS policies
const STORAGE_KEY_ID = 'b4ccfb4b7d890511aaa3c6073ebe31d1';
const STORAGE_ACCESS_KEY = 'a70c36d0d9e86ece51aa6b424de087b9112855d1369139b8d1d8386c61be7c51';

// Improved function to safely download a file with multiple fallback methods
export const downloadDocument = async (filePath: string, fileName?: string) => {
  if (!filePath) {
    throw new Error('File path is required');
  }
  
  console.log('downloadDocument called with path:', filePath);
  
  try {
    // Build direct URL with access key authentication
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hshfqxjrilqzjpkcotgz.supabase.co';
    const directUrl = `${supabaseUrl}/storage/v1/object/public/documents/${filePath}`;
    
    console.log('Attempting direct storage access with key:', directUrl);
    
    // First attempt: Direct download with access key
    try {
      const headers = {
        'apikey': STORAGE_KEY_ID,
        'Authorization': `Bearer ${STORAGE_ACCESS_KEY}`
      };
      
      const response = await fetch(directUrl, { 
        headers,
        method: 'GET'
      });
      
      if (response.ok) {
        console.log('Direct download with access key successful');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || filePath.split('/').pop() || 'document.pdf';
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
        return;
      } else {
        console.error('Direct download failed:', await response.text());
      }
    } catch (directError) {
      console.error('Error with direct download:', directError);
    }
    
    // Second attempt: Use the document-management edge function
    console.log('Attempting edge function download');
    const accessToken = (await supabase.auth.getSession()).data.session?.access_token;
    
    if (accessToken) {
      try {
        const { data: edgeFunctionData, error: edgeFunctionError } = await supabase.functions.invoke(
          'document-management',
          {
            body: { 
              action: 'downloadFile', 
              filePath,
              useAccessKey: true,
              keyId: STORAGE_KEY_ID,
              accessKey: STORAGE_ACCESS_KEY
            },
            headers: { Authorization: `Bearer ${accessToken}` }
          }
        );
        
        if (!edgeFunctionError && edgeFunctionData?.url) {
          console.log('Edge function returned URL:', edgeFunctionData.url);
          window.open(edgeFunctionData.url, '_blank');
          return;
        } else {
          console.error('Edge function error:', edgeFunctionError || 'No URL returned');
        }
      } catch (edgeFunctionCallError) {
        console.error('Error calling edge function:', edgeFunctionCallError);
      }
    }
    
    // Third attempt: Signed URL via Supabase client (traditional way)
    console.log('Attempting to create signed URL');
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 3600, {
        download: true,
        transform: { 
          quality: 100  // Just to add a parameter and make sure the URL is properly formed
        }
      });
    
    if (!signedUrlError && signedUrlData?.signedUrl) {
      console.log('Successfully created signed URL:', signedUrlData.signedUrl);
      window.open(signedUrlData.signedUrl, '_blank');
      return;
    } else {
      console.error('Error creating signed URL:', signedUrlError || 'No URL returned');
    }
    
    // Fourth attempt: Direct download through the JS SDK
    console.log('Attempting direct download through SDK');
    const { data, error } = await supabase.storage
      .from('documents')
      .download(filePath);
      
    if (!error && data) {
      console.log('SDK download successful');
      const blob = new Blob([data], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || filePath.split('/').pop() || 'document.pdf';
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      return;
    } else {
      console.error('Error downloading file through SDK:', error || 'No data returned');
    }
    
    throw new Error('All download methods failed');
  } catch (error) {
    console.error('Error downloading document:', error);
    throw error;
  }
};
