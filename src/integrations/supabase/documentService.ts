import { Session } from "@supabase/supabase-js";
import { supabase } from "./client";

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

const getDocumentManagementUrl = (endpoint: string, params?: Record<string, string>) => {
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

export const uploadDocumentFile = async (
  session: Session,
  resourceType: string,
  resourceId: string,
  file: File
) => {
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

export const getDocumentUrl = (filePath: string) => {
  const { data } = supabase.storage
    .from('documents')
    .getPublicUrl(filePath);
  
  return data.publicUrl;
};

const STORAGE_KEY_ID = 'b4ccfb4b7d890511aaa3c6073ebe31d1';
const STORAGE_ACCESS_KEY = 'a70c36d0d9e86ece51aa6b424de087b9112855d1369139b8d1d8386c61be7c51';

export const downloadDocument = async (filePath: string, fileName?: string) => {
  if (!filePath) {
    throw new Error('File path is required');
  }
  
  console.log('downloadDocument called with path:', filePath);
  
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hshfqxjrilqzjpkcotgz.supabase.co';
    
    // First try: Check if file exists before attempting to download
    try {
      const { data: fileExistsData, error: fileExistsError } = await supabase.storage
        .from('documents')
        .list(filePath.split('/').slice(0, -1).join('/'));
      
      const fileExists = fileExistsData?.some(file => file.name === filePath.split('/').pop());
      
      if (fileExistsError || !fileExists) {
        console.error('File does not exist in storage:', filePath);
        throw new Error(`File does not exist: ${filePath}`);
      }
      
      console.log('File exists in storage, proceeding with download');
    } catch (existsError) {
      console.error('Error checking if file exists:', existsError);
      // Continue anyway, as the list API might be restricted
    }
    
    // Try direct access with provided credentials
    const directUrl = `${supabaseUrl}/storage/v1/object/public/documents/${filePath}`;
    
    console.log('Attempting direct access with provided credentials');
    
    try {
      const headers = {
        'apikey': 'b4ccfb4b7d890511aaa3c6073ebe31d1',
        'Authorization': `Bearer a70c36d0d9e86ece51aa6b424de087b9112855d1369139b8d1d8386c61be7c51`
      };
      
      const downloadUrl = `${directUrl}?download=true`;
      
      console.log('Using direct download URL with access credentials:', downloadUrl);
      
      const response = await fetch(downloadUrl, { 
        headers,
        method: 'GET'
      });
      
      if (response.ok) {
        console.log('Direct download successful');
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
        console.error('Direct download failed with status:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
      }
    } catch (directError) {
      console.error('Error with direct download:', directError);
    }
    
    // Try S3 compatible API approach
    console.log('Attempting S3 compatible approach');
    try {
      const s3EndpointUrl = `${supabaseUrl}/storage/v1/s3/object/documents/${filePath}?download=true`;
      
      const response = await fetch(s3EndpointUrl, {
        headers: {
          'x-amz-access-key-id': 'b4ccfb4b7d890511aaa3c6073ebe31d1',
          'x-amz-secret-access-key': 'a70c36d0d9e86ece51aa6b424de087b9112855d1369139b8d1d8386c61be7c51'
        },
        method: 'GET'
      });
      
      if (response.ok) {
        console.log('S3 compatible download successful');
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
        console.error('S3 compatible download failed with status:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
      }
    } catch (s3Error) {
      console.error('Error with S3 compatible download:', s3Error);
    }
    
    // Try edge function as fallback
    console.log('Attempting edge function download');
    try {
      const accessToken = (await supabase.auth.getSession()).data.session?.access_token;
      
      if (accessToken) {
        const { data: edgeFunctionData, error: edgeFunctionError } = await supabase.functions.invoke(
          'document-management',
          {
            body: { 
              action: 'downloadFile', 
              filePath,
              useAccessKey: true,
              keyId: 'b4ccfb4b7d890511aaa3c6073ebe31d1',
              accessKey: 'a70c36d0d9e86ece51aa6b424de087b9112855d1369139b8d1d8386c61be7c51'
            },
            headers: { Authorization: `Bearer ${accessToken}` }
          }
        );
        
        if (!edgeFunctionError && edgeFunctionData?.url) {
          console.log('Edge function returned URL:', edgeFunctionData.url);
          window.open(edgeFunctionData.url, '_blank');
          return;
        } else {
          console.error('Edge function error or no URL returned:', edgeFunctionError || 'No URL returned');
        }
      }
    } catch (edgeFunctionError) {
      console.error('Error calling edge function:', edgeFunctionError);
    }
    
    // Try with signed URL as last resort
    console.log('Attempting signed URL approach');
    try {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 60, {
          download: true,
          transform: { quality: 100 }
        });
      
      if (!signedUrlError && signedUrlData?.signedUrl) {
        console.log('Successfully created signed URL:', signedUrlData.signedUrl);
        window.open(signedUrlData.signedUrl, '_blank');
        return;
      } else {
        console.error('Error creating signed URL:', signedUrlError || 'No URL returned');
        if (signedUrlError?.message.includes("Object not found")) {
          throw new Error(`File does not exist: ${filePath}`);
        }
      }
    } catch (signedUrlError) {
      console.error('Error with signed URL approach:', signedUrlError);
      throw signedUrlError;
    }
    
    throw new Error(`Unable to download file: ${filePath}. File may not exist.`);
  } catch (error) {
    console.error('Error downloading document:', error);
    throw error;
  }
};
