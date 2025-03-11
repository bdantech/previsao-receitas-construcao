
import { useState, useEffect } from "react";
import { documentManagementApi, supabase } from "@/integrations/supabase/client";
import { Loader, Upload, File, CheckCircle, AlertCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface DocumentType {
  id: string;
  name: string;
  description?: string;
  required?: boolean;
}

// Rename Document to CompanyDocument to avoid conflict with the global Document interface
interface CompanyDocument {
  id: string;
  document_type: DocumentType;
  status: "not_sent" | "sent" | "approved" | "needs_revision";
  file_name: string;
  file_path: string;
  review_notes?: string;
  submitted_at?: string;
  submitted_by?: { id: string; email: string };
  reviewed_at?: string;
  reviewer?: { id: string; email: string };
}

interface CompanyDocumentsProps {
  companyId: string;
}

export const CompanyDocuments: React.FC<CompanyDocumentsProps> = ({ companyId }) => {
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  // Fetch company documents
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      console.log("Fetching documents for company:", companyId);
      const docs = await documentManagementApi.getCompanyDocuments(companyId);
      console.log("Retrieved documents:", docs);
      setDocuments(docs);
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
  };

  useEffect(() => {
    if (companyId) {
      fetchDocuments();
    }
  }, [companyId]);

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

  // Get status badge based on document status
  const getStatusBadge = (status: CompanyDocument['status']) => {
    switch (status) {
      case 'approved':
        return <span className="inline-flex items-center gap-1 text-green-700 bg-green-100 px-2 py-1 rounded text-xs"><CheckCircle className="h-3 w-3" /> Aprovado</span>;
      case 'needs_revision':
        return <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-100 px-2 py-1 rounded text-xs"><AlertCircle className="h-3 w-3" /> Revisão Necessária</span>;
      case 'sent':
        return <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-100 px-2 py-1 rounded text-xs"><File className="h-3 w-3" /> Enviado</span>;
      case 'not_sent':
        return <span className="inline-flex items-center gap-1 text-gray-700 bg-gray-100 px-2 py-1 rounded text-xs"><Upload className="h-3 w-3" /> Não Enviado</span>;
      default:
        return <span className="inline-flex items-center gap-1 text-gray-700 bg-gray-100 px-2 py-1 rounded text-xs">{status}</span>;
    }
  };

  // Helper function to determine if a document has a file
  const hasFile = (doc: CompanyDocument) => {
    return doc.file_path && doc.file_path.trim().length > 0;
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Documentos da Empresa</h2>
      
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Nenhum documento encontrado.
        </div>
      ) : (
        <div className="grid gap-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="bg-white p-4 rounded-lg shadow-sm border border-gray-200"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="font-medium">{doc.document_type.name}</h3>
                  {doc.document_type.description && (
                    <p className="text-sm text-gray-500">{doc.document_type.description}</p>
                  )}
                  <div className="flex items-center gap-2">
                    {getStatusBadge(doc.status)}
                    {doc.document_type.required && (
                      <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
                        Obrigatório
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {hasFile(doc) ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadDocument(doc)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                      {(doc.status === "not_sent" || doc.status === "needs_revision") && (
                        <div className="relative">
                          <input
                            type="file"
                            onChange={(e) => handleFileUpload(doc.id, doc.document_type.id, e)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            disabled={uploading[doc.id]}
                          />
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={uploading[doc.id]}
                          >
                            {uploading[doc.id] ? (
                              <Loader className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Upload className="h-4 w-4 mr-2" />
                            )}
                            Atualizar
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    (doc.status === "not_sent" || doc.status === "needs_revision") && (
                      <div className="relative">
                        <input
                          type="file"
                          onChange={(e) => handleFileUpload(doc.id, doc.document_type.id, e)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          disabled={uploading[doc.id]}
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={uploading[doc.id]}
                        >
                          {uploading[doc.id] ? (
                            <Loader className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Upload className="h-4 w-4 mr-2" />
                          )}
                          Enviar
                        </Button>
                      </div>
                    )
                  )}
                </div>
              </div>
              
              {doc.status === "needs_revision" && doc.review_notes && (
                <div className="mt-3 text-sm bg-yellow-50 text-yellow-800 p-3 rounded">
                  <p className="font-medium">Observações da revisão:</p>
                  <p>{doc.review_notes}</p>
                </div>
              )}
              
              {doc.submitted_at && (
                <div className="mt-3 text-xs text-gray-500">
                  Enviado por {doc.submitted_by?.email} em{" "}
                  {new Date(doc.submitted_at).toLocaleString()}
                </div>
              )}
              
              {doc.reviewed_at && (
                <div className="mt-1 text-xs text-gray-500">
                  Revisado por {doc.reviewer?.email} em{" "}
                  {new Date(doc.reviewed_at).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
