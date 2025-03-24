import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { CompanyDocument } from '@/types/document';
import { useToast } from '@/components/ui/use-toast';
import { downloadDocument } from '@/integrations/supabase/documentService';

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
  const { session, getAuthHeader } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  const fetchDocuments = useCallback(async () => {
    if (!companyId) return;
    
    setLoading(true);
    try {
      console.log('Fetching documents for company:', companyId);
      
      const { data, error } = await supabase.functions.invoke('document-management', {
        body: {
          action: 'getDocuments',
          resourceType: 'company',
          resourceId: companyId
        },
        headers: await getAuthHeader()
      });
      
      if (error) {
        console.error('Error from document-management function:', error);
        throw error;
      }
      
      console.log('Documents data received:', data);
      
      if (data && data.documents) {
        setDocuments(data.documents as CompanyDocument[]);
      } else {
        console.warn('No documents data returned from function');
        setDocuments([]);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to load documents. Please try again.',
        variant: 'destructive',
      });
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, toast, getAuthHeader]);

  useEffect(() => {
    if (companyId) {
      fetchDocuments();
    }
  }, [companyId, fetchDocuments]);

  const uploadFile = async (file: File, resourceType: string, resourceId: string, documentId?: string) => {
    try {
      const headers = await getAuthHeader();
      
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
          resourceId,
          documentId,
          userId: session?.user?.id
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
      // Upload the file with document ID included
      const uploadResult = await uploadFile(file, 'company', companyId, documentId);
      
      toast({
        title: 'Success',
        description: 'Document uploaded successfully.',
      });

      // Refresh documents to get the updated status
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

  const downloadDocumentHandler = async (document: CompanyDocument) => {
    if (!document.file_path) {
      toast({
        title: 'Erro',
        description: 'Não há arquivo disponível para download.',
        variant: 'destructive',
      });
      return;
    }

    try {
      console.log('Attempting to download file from path:', document.file_path);
      
      // Use the enhanced downloadDocument function with access key
      await downloadDocument(document.file_path, document.file_name);
      
      toast({
        title: 'Sucesso',
        description: 'Download do documento iniciado.',
      });
    } catch (error) {
      console.error('Error downloading document:', error);
      
      // Check if the error is about file not found
      const errorMessage = error instanceof Error ? error.message : "Erro ao baixar o documento";
      const isFileNotFound = errorMessage.includes("not found") || errorMessage.includes("does not exist");
      
      toast({
        title: 'Erro',
        description: isFileNotFound 
          ? "Arquivo não encontrado. O arquivo pode ter sido removido."
          : errorMessage,
        variant: 'destructive',
      });
    }
  };

  return {
    documents,
    loading,
    uploading,
    getDocuments: fetchDocuments,
    updateDocumentStatus,
    uploadFile,
    handleFileUpload,
    downloadDocument: downloadDocumentHandler,
    fetchDocuments
  };
};
