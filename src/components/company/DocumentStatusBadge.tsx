
import { CheckCircle, AlertCircle, File, Upload, XCircle } from "lucide-react";

type DocumentStatus = 'not_sent' | 'sent' | 'approved' | 'needs_revision' | 'rejected';

interface DocumentStatusBadgeProps {
  status: DocumentStatus;
}

export const DocumentStatusBadge: React.FC<DocumentStatusBadgeProps> = ({ status }) => {
  switch (status) {
    case 'approved':
      return <span className="inline-flex items-center gap-1 text-green-700 bg-green-100 px-2 py-1 rounded text-xs"><CheckCircle className="h-3 w-3" /> Aprovado</span>;
    case 'needs_revision':
      return <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-100 px-2 py-1 rounded text-xs"><AlertCircle className="h-3 w-3" /> Revisão Necessária</span>;
    case 'rejected':
      return <span className="inline-flex items-center gap-1 text-red-700 bg-red-100 px-2 py-1 rounded text-xs"><XCircle className="h-3 w-3" /> Reprovado</span>;
    case 'sent':
      return <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-100 px-2 py-1 rounded text-xs"><File className="h-3 w-3" /> Enviado</span>;
    case 'not_sent':
      return <span className="inline-flex items-center gap-1 text-gray-700 bg-gray-100 px-2 py-1 rounded text-xs"><Upload className="h-3 w-3" /> Não Enviado</span>;
    default:
      return <span className="inline-flex items-center gap-1 text-gray-700 bg-gray-100 px-2 py-1 rounded text-xs">{status}</span>;
  }
};
