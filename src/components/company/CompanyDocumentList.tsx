
import { useState, useEffect } from "react";
import { DocumentList } from "./DocumentList";
import { CompanyDocument } from "@/types/document";
import { documentManagementApi, supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface CompanyDocumentListProps {
  companyId: string;
}

export const CompanyDocumentList: React.FC<CompanyDocumentListProps> = ({ companyId }) => {
  const { session } = useAuth();
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchDocuments();
  }, [companyId]);

  const fetchDocuments = async () => {
    if (!companyId) return;
    
    try {
      setLoading(true);
      const documents = await documentManagementApi.getCompanyDocuments(companyId);
      setDocuments(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os documentos da empresa",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (documentId: string, documentTypeId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files[0]) return;
    
    const file = event.target.files[0];
    
    setUploading(prev => ({ ...prev, [documentId]: true }));
    
    try {
      // Create a storage path for the file
      const filePath = `company-documents/${companyId}/${documentId}/${file.name}`;
      
      // Upload file to Storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          upsert: true
        });
      
      if (uploadError) {
        throw uploadError;
      }
      
      // Update the document record
      await documentManagementApi.submitDocument({
        documentTypeId,
        resourceType: 'company',
        resourceId: companyId,
        filePath,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type
      });
      
      toast({
        title: "Sucesso",
        description: "Documento enviado com sucesso",
      });
      
      // Refresh the document list
      fetchDocuments();
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

  const handleDownload = async (document: CompanyDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(document.file_path);
      
      if (error) {
        throw error;
      }
      
      // Create a temporary URL for the downloaded file
      const url = URL.createObjectURL(data);
      
      // Create a link element and trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = document.file_name;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading document:", error);
      toast({
        title: "Erro",
        description: "Não foi possível baixar o documento",
        variant: "destructive",
      });
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        Nenhum documento encontrado
      </div>
    );
  }
  
  return (
    <DocumentList 
      documents={documents}
      uploading={uploading}
      onFileUpload={handleFileUpload}
      onDownload={handleDownload}
    />
  );
};
