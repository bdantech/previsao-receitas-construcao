
import { useState, useCallback, useEffect } from "react";
import { documentManagementApi, supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CompanyDocument } from "@/types/document";
import { useAuth } from "@/hooks/useAuth";

export const useCompanyDocuments = (companyId: string) => {
  const { session, isLoading: isAuthLoading } = useAuth();
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  // Fetch company documents
  const fetchDocuments = useCallback(async () => {
    if (!companyId) {
      console.log("No company ID provided");
      setLoading(false);
      return;
    }

    if (!session?.access_token) {
      console.log("No valid session");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log("Fetching documents for company:", companyId);
      
      const docs = await documentManagementApi.getCompanyDocuments(companyId);
      console.log("Retrieved documents:", docs);
      
      if (Array.isArray(docs)) {
        setDocuments(docs);
      } else {
        console.error("Unexpected document format:", docs);
        setDocuments([]);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os documentos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [companyId, session?.access_token]);

  // Load documents when session and companyId are available
  useEffect(() => {
    if (!isAuthLoading && session?.access_token && companyId) {
      fetchDocuments();
    }
  }, [companyId, session?.access_token, isAuthLoading, fetchDocuments]);

  // Handle file upload
  const handleFileUpload = async (documentId: string, documentTypeId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !companyId) return;

    try {
      setUploading(prev => ({ ...prev, [documentId]: true }));
      
      // Upload file to Supabase Storage
      const filePath = `companies/${companyId}/documents/${documentTypeId}/${Date.now()}_${file.name}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });
      
      if (uploadError) throw uploadError;
      
      // Update document in database
      await documentManagementApi.submitDocument({
        documentTypeId,
        resourceType: 'company',
        resourceId: companyId,
        filePath: uploadData.path,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type
      });
      
      // Refresh document list
      await fetchDocuments();
      
      toast({
        title: "Sucesso",
        description: "Documento enviado com sucesso",
      });
    } catch (error) {
      console.error("Error uploading document:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar o documento",
        variant: "destructive",
      });
    } finally {
      setUploading(prev => ({ ...prev, [documentId]: false }));
    }
  };

  // Download document
  const downloadDocument = async (doc: CompanyDocument) => {
    try {
      if (!doc.file_path) {
        toast({
          title: "Aviso",
          description: "Este documento ainda não possui um arquivo para download",
          variant: "default",
        });
        return;
      }
      
      const { data, error } = await supabase.storage
        .from('documents')
        .download(doc.file_path);
      
      if (error) throw error;
      
      // Create a download link
      const url = URL.createObjectURL(data);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      window.document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      window.document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading document:", error);
      toast({
        title: "Erro",
        description: "Não foi possível baixar o documento",
        variant: "destructive",
      });
    }
  };

  return {
    documents,
    loading,
    uploading,
    fetchDocuments,
    handleFileUpload,
    downloadDocument
  };
};
