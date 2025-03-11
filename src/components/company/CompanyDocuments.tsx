
import { useEffect } from "react";
import { Loader } from "lucide-react";
import { DocumentList } from "./DocumentList";
import { useCompanyDocuments } from "@/hooks/useCompanyDocuments";

interface CompanyDocumentsProps {
  companyId: string;
}

export const CompanyDocuments: React.FC<CompanyDocumentsProps> = ({ companyId }) => {
  const { 
    documents, 
    loading, 
    uploading, 
    handleFileUpload, 
    downloadDocument, 
    fetchDocuments 
  } = useCompanyDocuments(companyId);

  useEffect(() => {
    if (companyId) {
      fetchDocuments();
    }
  }, [companyId, fetchDocuments]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Documentos da Empresa</h2>
      
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>Nenhum documento encontrado.</p>
          <button 
            onClick={fetchDocuments}
            className="mt-2 text-blue-500 hover:text-blue-700 underline"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <DocumentList 
          documents={documents} 
          uploading={uploading} 
          onFileUpload={handleFileUpload} 
          onDownload={downloadDocument} 
        />
      )}
    </div>
  );
};
