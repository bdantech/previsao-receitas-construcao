
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

interface Document {
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
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  // Fetch company documents
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const docs = await documentManagementApi.getCompanyDocuments(companyId);
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
  const downloadDocument = async (document: Document) => {
    try {
      if (!document.file_path) {
        toast({
          title: "Erro",
          description: "Não há arquivo para download",
          variant: "destructive",
        });
        return;
      }
      
      const { data, error } = await supabase.storage
        .from('documents')
        .download(document.file_path);
      
      if (error) throw error;
      
      // Create a download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = document.file_name;
      document.body.appendChild(a);
      a.click();
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

  // Get status badge based on document status
  const getStatusBadge = (status: Document['status']) => {
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

  if (loading) {
    return (
      <div className="flex justify-center my-8">
        <Loader className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold mb-4">Documentos da Empresa</h2>
      
      {documents.length === 0 ? (
        <div className="bg-white p-6 rounded-lg shadow-sm text-center">
          <p className="text-gray-500">Nenhum documento encontrado para esta empresa.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Documento</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Arquivo</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{doc.document_type.name}</div>
                      {doc.document_type.description && (
                        <div className="text-sm text-gray-500">{doc.document_type.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(doc.status)}
                      {doc.review_notes && (
                        <div className="mt-1 text-xs text-gray-500 max-w-xs">{doc.review_notes}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {doc.file_name !== "Pending Upload - " + doc.document_type.name ? (
                        <div className="text-sm text-gray-900">{doc.file_name}</div>
                      ) : (
                        <div className="text-sm text-gray-500">Nenhum arquivo enviado</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(doc.status === 'not_sent' || doc.status === 'needs_revision') ? (
                        <div>
                          <label htmlFor={`file-upload-${doc.id}`} className="cursor-pointer">
                            <div className="relative">
                              <Button size="sm" disabled={!!uploading[doc.id]}>
                                {uploading[doc.id] ? (
                                  <><Loader className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
                                ) : (
                                  <><Upload className="h-4 w-4 mr-2" /> Enviar Documento</>
                                )}
                              </Button>
                              <input
                                id={`file-upload-${doc.id}`}
                                type="file"
                                className="sr-only"
                                onChange={(e) => handleFileUpload(doc.id, doc.document_type.id, e)}
                                disabled={!!uploading[doc.id]}
                              />
                            </div>
                          </label>
                        </div>
                      ) : doc.file_path && doc.file_path !== "" ? (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => downloadDocument(doc)}
                        >
                          <Download className="h-4 w-4 mr-2" /> Baixar
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
