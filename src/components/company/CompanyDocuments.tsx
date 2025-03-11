
import { useState, useEffect } from "react";
import { documentManagementApi } from "@/integrations/supabase/client";
import { Loader } from "lucide-react";
import { DocumentList } from "./DocumentList";
import { useCompanyDocuments } from "@/hooks/useCompanyDocuments";
import { CompanyDocument } from "@/types/document";

interface CompanyDocumentsProps {
  companyId: string;
}

export const CompanyDocuments: React.FC<CompanyDocumentsProps> = ({ companyId }) => {
  const { documents, loading, uploading, handleFileUpload, downloadDocument, fetchDocuments } = 
    useCompanyDocuments(companyId);

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
          Nenhum documento encontrado.
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
