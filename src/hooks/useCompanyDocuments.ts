
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { CompanyDocument } from '@/types/document';
import { useToast } from '@/components/ui/use-toast';

interface Document {
  id: string;
  document_type_id: string;
  resource_type: string;
  resource_id: string;
  status: "sent" | "approved" | "needs_revision" | "not_sent";
  file_path: string;
  file_name: string;
  submitted_by: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
}

export const useCompanyDocuments = (companyId?: string) => {
  const { getAuthHeader } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  const fetchDocuments = useCallback(async () => {
    if (!companyId) return;
    
    setLoading(true);
    try {
      const result = await getDocuments('company', companyId);
      setDocuments(result as unknown as CompanyDocument[]);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to load documents. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [companyId, toast]);

  useEffect(() => {
    if (companyId) {
      fetchDocuments();
    }
  }, [companyId, fetchDocuments]);

  const uploadFile = async (file: File, resourceType: string, resourceId: string) => {
    try {
      const headers = getAuthHeader();
      
      // Convert file to base64
      const base64File = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
      });

      const { data, error } = await supabase.functions.invoke('document-management', {
        body: {
          action: 'uploadFile',
          file: base64File,
          fileName: file.name,
          resourceType,
          resourceId
        },
        headers: headers
      });

      if (error) {
        console.error('Error uploading file:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  const getDocuments = async (resourceType: string, resourceId: string): Promise<Document[]> => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          id,
          document_type_id,
          resource_type,
          resource_id,
          status,
          file_path,
          file_name,
          submitted_by,
          submitted_at,
          reviewed_by,
          reviewed_at,
          review_notes,
          document_type:document_type_id(id, name, description, required),
          submitter:submitted_by(id, email),
          reviewer:reviewed_by(id, email)
        `)
        .eq('resource_type', resourceType)
        .eq('resource_id', resourceId);

      if (error) {
        console.error('Error fetching documents:', error);
        throw error;
      }

      // Transform the data to match the CompanyDocument type
      const formattedDocuments = data.map(doc => ({
        id: doc.id,
        document_type: doc.document_type,
        status: doc.status,
        file_name: doc.file_name,
        file_path: doc.file_path,
        review_notes: doc.review_notes,
        submitted_at: doc.submitted_at,
        submitted_by: doc.submitter,
        reviewed_at: doc.reviewed_at,
        reviewer: doc.reviewer
      }));

      return formattedDocuments as unknown as Document[];
    } catch (error) {
      console.error('Error:', error);
      return [];
    }
  };

  const updateDocumentStatus = async (documentId: string, status: "sent" | "approved" | "needs_revision" | "not_sent") => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .update({ status })
        .eq('id', documentId)
        .select();

      if (error) {
        console.error('Error updating document status:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error updating document status:', error);
      throw error;
    }
  };

  const handleFileUpload = async (documentId: string, documentTypeId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !companyId) return;

    setUploading(prev => ({ ...prev, [documentId]: true }));

    try {
      // Upload the file
      const uploadResult = await uploadFile(file, 'company', companyId);
      
      // Update the document record
      const { error } = await supabase
        .from('documents')
        .update({
          file_name: file.name,
          file_path: uploadResult.filePath,
          status: 'sent',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Document uploaded successfully.',
      });

      // Refresh documents
      fetchDocuments();
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload document. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(prev => ({ ...prev, [documentId]: false }));
    }
  };

  const downloadDocument = async (document: CompanyDocument) => {
    if (!document.file_path) {
      toast({
        title: 'Error',
        description: 'No file available to download.',
        variant: 'destructive',
      });
      return;
    }

    try {
      console.log('Attempting to download file from path:', document.file_path);
      
      // Create a signed URL for the file instead of directly downloading it
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(document.file_path, 60); // 60 seconds expiry
      
      if (error) {
        console.error('Error creating signed URL:', error);
        throw error;
      }
      
      if (!data || !data.signedUrl) {
        throw new Error('Failed to generate download URL');
      }
      
      // Open the signed URL in a new tab
      window.open(data.signedUrl, '_blank');
      
      toast({
        title: 'Success',
        description: 'Document download started.',
      });
    } catch (error) {
      console.error('Error downloading document:', error);
      toast({
        title: 'Error',
        description: 'Failed to download document. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return {
    documents,
    loading,
    uploading,
    getDocuments,
    updateDocumentStatus,
    uploadFile,
    handleFileUpload,
    downloadDocument,
    fetchDocuments
  };
};
