
import { useEffect } from "react";
import { Loader } from "lucide-react";
import { DocumentList } from "./DocumentList";
import { useCompanyDocuments } from "@/hooks/useCompanyDocuments";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { CompanyStatusBadge } from "./CompanyStatusBadge";
import { useAuth } from "@/hooks/useAuth"; 

interface CompanyDocumentsProps {
  companyId: string;
  isAdmin?: boolean;
}

export const CompanyDocuments: React.FC<CompanyDocumentsProps> = ({ 
  companyId,
  isAdmin = false 
}) => {
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
      console.log('CompanyDocuments: Fetching documents for company ID:', companyId);
      fetchDocuments();
    }
  }, [companyId, fetchDocuments]);

  console.log('CompanyDocuments: Current documents:', documents);
  console.log('CompanyDocuments: Loading state:', loading);

  // Check the overall status of documents
  const getDocumentsStatus = () => {
    if (documents.length === 0) return 'incomplete';
    
    // If any document is not sent, status is incomplete
    if (documents.some(doc => doc.status === 'not_sent')) return 'incomplete';
    
    // If any document needs revision, status is pending
    if (documents.some(doc => doc.status === 'needs_revision')) return 'pending';
    
    // If any document is sent but not approved, status is pending
    if (documents.some(doc => doc.status === 'sent')) return 'pending';
    
    // If all documents are approved, status is approved
    if (documents.every(doc => doc.status === 'approved')) return 'approved';
    
    // Fallback
    return 'pending';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Documentos da Empresa</h2>
        {documents.length > 0 && (
          <div className="flex items-center">
            <span className="mr-2 text-sm text-gray-500">Status Geral:</span>
            <CompanyStatusBadge status={getDocumentsStatus()} />
          </div>
        )}
      </div>
      
      {documents.some(doc => doc.status === 'needs_revision') && (
        <Alert className="bg-amber-50 border-amber-200 mb-4">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Alguns documentos necessitam de revisão. Por favor, atualize-os para continuar com o processo.
          </AlertDescription>
        </Alert>
      )}
      
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
          onRefresh={fetchDocuments}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
};
