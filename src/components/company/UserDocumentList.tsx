
import { useState, useEffect } from "react";
import { DocumentList } from "./DocumentList";
import { CompanyDocument } from "@/types/document";
import { documentManagementApi, supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export const UserDocumentList: React.FC = () => {
  const { session } = useAuth();
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchDocuments();
  }, [session?.user?.id]);

  const fetchDocuments = async () => {
    if (!session?.user?.id) return;
    
    try {
      setLoading(true);
      const documents = await documentManagementApi.getUserDocuments();
      setDocuments(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os seus documentos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (documentId: string, documentTypeId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files[0] || !session?.user?.id) return;
    
    const file = event.target.files[0];
    
    setUploading(prev => ({ ...prev, [documentId]: true }));
    
    try {
      // Create a storage path for the file
      const filePath = `user-documents/${session.user.id}/${documentId}/${file.name}`;
      
      // Upload file to Storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          upsert: true
        });
      
      if (uploadError) {
        throw uploadError;
      }
      
      // Get the document to get its resource info
      const documentToUpdate = documents.find(doc => doc.id === documentId);
      
      if (!documentToUpdate) {
        throw new Error("Document not found");
      }
      
      // Update the document record
      await documentManagementApi.submitDocument({
        documentTypeId,
        resourceType: documentToUpdate.resource_type,
        resourceId: documentToUpdate.resource_id,
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
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.file_name;
      window.document.body.appendChild(a);
      a.click();
      
      // Clean up
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
