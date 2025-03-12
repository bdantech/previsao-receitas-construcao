
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
      
      // Use the service role client for admin users and regular client for company users
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
    if (!file || !companyId || !session?.access_token) return;

    try {
      setUploading(prev => ({ ...prev, [documentId]: true }));
      
      // Convert file to base64 for secure transmission through the edge function
      const reader = new FileReader();
      
      // Create a promise to handle the FileReader async operation
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('Failed to convert file to base64'));
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      
      // Generate file path
      const filePath = `companies/${companyId}/documents/${documentTypeId}/${Date.now()}_${file.name}`;
      
      console.log("Uploading file to path:", filePath);
      
      // Upload file using the document-management edge function to bypass RLS
      const uploadResponse = await supabase.functions.invoke('document-management', {
        body: {
          action: 'uploadFile',
          bucket: 'documents',
          filePath: filePath, 
          fileBase64: fileBase64,
          contentType: file.type
        }
      });
      
      if (uploadResponse.error) {
        console.error("Upload error:", uploadResponse.error);
        throw new Error(uploadResponse.error);
      }
      
      console.log("File uploaded successfully:", uploadResponse);
      
      // Update document in database using the document-management edge function
      await documentManagementApi.submitDocument({
        documentTypeId,
        resourceType: 'company',
        resourceId: companyId,
        filePath: uploadResponse.data.path,
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
        description: "Não foi possível enviar o documento: " + (error.message || ''),
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
      
      if (error) {
        console.error("Download error:", error);
        throw error;
      }
      
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
