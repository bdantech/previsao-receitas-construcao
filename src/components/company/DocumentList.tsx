
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { documentManagementApi } from "@/integrations/supabase/client";
import { CompanyDocument } from "@/types/document";
import { AlertCircle, CheckCircle, Download, Loader, Upload, XCircle } from "lucide-react";
import { useState } from "react";
import { DocumentReviewDialog } from "./DocumentReviewDialog";
import { DocumentStatusBadge } from "./DocumentStatusBadge";

interface DocumentListProps {
  documents: CompanyDocument[];
  uploading: Record<string, boolean>;
  onFileUpload: (documentId: string, documentTypeId: string, event: React.ChangeEvent<HTMLInputElement>) => void;
  onDownload: (document: CompanyDocument) => void;
  onRefresh?: () => void;
  isAdmin?: boolean;
}

export const DocumentList: React.FC<DocumentListProps> = ({ 
  documents, 
  uploading, 
  onFileUpload, 
  onDownload,
  onRefresh,
  isAdmin = false
}) => {
  const { session } = useAuth();
  const [reviewDialogState, setReviewDialogState] = useState<{
    isOpen: boolean;
    documentId: string;
    documentName: string;
    actionType: "approve" | "reject" | "revision";
  }>({
    isOpen: false,
    documentId: "",
    documentName: "",
    actionType: "approve"
  });

  // Helper function to determine if a document has a file
  const hasFile = (doc: CompanyDocument) => {
    return doc.file_path && doc.file_path.trim().length > 0;
  };

  // Fallback download method that uses our improved documentService
  const handleFallbackDownload = async (doc: CompanyDocument) => {
    try {
      console.log('Using enhanced download method with access key for:', doc.file_path);
      
      // Try to download using the enhanced utility
      const { data, error } = await documentManagementApi.getDocumentSignedUrl(doc.file_path);
      if (error) {
        console.error('Error downloading contract:', error);
        throw error;
      }

      if(data.signedUrl){
        const response = await fetch(data.signedUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.file_name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);

      }
    } catch (error) {
      console.error("Error with fallback download:", error);
      
      // If the error is about file not found, show a clear message
      if (error instanceof Error && 
          (error.message.includes("not found") || error.message.includes("does not exist"))) {
        // Show toast or other notification
        onDownload({
          ...doc,
          error: "Arquivo não encontrado. O arquivo pode ter sido removido."
        } as any);
      } else {
        // If it's another error, still try the original method
        onDownload(doc);
      }
    }
  };

  const openReviewDialog = (documentId: string, documentName: string, actionType: "approve" | "reject" | "revision") => {
    setReviewDialogState({
      isOpen: true,
      documentId,
      documentName,
      actionType
    });
  };

  const closeReviewDialog = () => {
    setReviewDialogState({
      ...reviewDialogState,
      isOpen: false
    });
  };

  const handleReviewSuccess = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

  const renderAdminActions = (doc: CompanyDocument) => {
    if (!isAdmin || !hasFile(doc)) return null;

    // Don't show review buttons for documents that are not sent
    if (doc.status === "not_sent") return null;

    // Don't show approve button for already approved documents
    const showApprove = doc.status !== "approved";
    
    // Don't show reject/revision buttons for already rejected documents
    const showRejectRevision = doc.status !== "rejected";

    return (
      <div className="flex flex-wrap gap-2 mt-3">
        {showApprove && (
          <Button
            variant="success"
            size="sm"
            onClick={() => openReviewDialog(doc.id, doc.file_name, "approve")}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Aprovar
          </Button>
        )}
        {showRejectRevision && (
          <>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => openReviewDialog(doc.id, doc.file_name, "reject")}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Reprovar
            </Button>
            <Button
              variant="warning"
              size="sm"
              onClick={() => openReviewDialog(doc.id, doc.file_name, "revision")}
            >
              <AlertCircle className="h-4 w-4 mr-1" />
              Solicitar Revisão
            </Button>
          </>
        )}
      </div>
    );
  };

  return (
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
                <DocumentStatusBadge status={doc.status} />
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
                    onClick={() => handleFallbackDownload(doc)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  {!isAdmin && (doc.status === "not_sent" || doc.status === "needs_revision") && (
                    <DocumentUploader 
                      documentId={doc.id}
                      documentTypeId={doc.document_type.id}
                      isUploading={uploading[doc.id]}
                      onFileUpload={onFileUpload}
                      buttonText="Atualizar"
                    />
                  )}
                </>
              ) : (
                !isAdmin && (doc.status === "not_sent" || doc.status === "needs_revision") && (
                  <DocumentUploader 
                    documentId={doc.id}
                    documentTypeId={doc.document_type.id}
                    isUploading={uploading[doc.id]}
                    onFileUpload={onFileUpload}
                    buttonText="Enviar"
                  />
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
          
          {renderAdminActions(doc)}
          
          <DocumentMetadata 
            submittedAt={doc.submitted_at} 
            submittedBy={doc.submitted_by?.email} 
            reviewedAt={doc.reviewed_at} 
            reviewedBy={doc.reviewer?.email}
          />
        </div>
      ))}

      <DocumentReviewDialog 
        documentId={reviewDialogState.documentId}
        documentName={reviewDialogState.documentName}
        isOpen={reviewDialogState.isOpen}
        onClose={closeReviewDialog}
        onSuccess={handleReviewSuccess}
        actionType={reviewDialogState.actionType}
      />
    </div>
  );
};

interface DocumentUploaderProps {
  documentId: string;
  documentTypeId: string;
  isUploading: boolean;
  onFileUpload: (documentId: string, documentTypeId: string, event: React.ChangeEvent<HTMLInputElement>) => void;
  buttonText: string;
}

const DocumentUploader: React.FC<DocumentUploaderProps> = ({ 
  documentId, 
  documentTypeId, 
  isUploading, 
  onFileUpload,
  buttonText
}) => {
  return (
    <div className="relative">
      <input
        type="file"
        onChange={(e) => onFileUpload(documentId, documentTypeId, e)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={isUploading}
      />
      <Button
        variant="secondary"
        size="sm"
        disabled={isUploading}
      >
        {isUploading ? (
          <Loader className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Upload className="h-4 w-4 mr-2" />
        )}
        {buttonText}
      </Button>
    </div>
  );
};

interface DocumentMetadataProps {
  submittedAt?: string;
  submittedBy?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

const DocumentMetadata: React.FC<DocumentMetadataProps> = ({ 
  submittedAt, 
  submittedBy, 
  reviewedAt, 
  reviewedBy 
}) => {
  if (!submittedAt && !reviewedAt) return null;
  
  return (
    <>
      {submittedAt && (
        <div className="mt-3 text-xs text-gray-500">
          Enviado por {submittedBy} em{" "}
          {new Date(submittedAt).toLocaleString()}
        </div>
      )}
      
      {reviewedAt && (
        <div className="mt-1 text-xs text-gray-500">
          Revisado por {reviewedBy} em{" "}
          {new Date(reviewedAt).toLocaleString()}
        </div>
      )}
    </>
  );
};
