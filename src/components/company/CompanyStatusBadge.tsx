
import { 
  BadgeCheck, 
  BadgeAlert, 
  BadgeX, 
  Upload 
} from "lucide-react";

type CompanyDocumentsStatus = 'incomplete' | 'pending' | 'approved' | 'rejected';

interface CompanyStatusBadgeProps {
  status: CompanyDocumentsStatus;
}

export const CompanyStatusBadge: React.FC<CompanyStatusBadgeProps> = ({ status }) => {
  switch (status) {
    case 'approved':
      return <span className="inline-flex items-center gap-1 text-green-700 bg-green-100 px-2 py-1 rounded text-xs"><BadgeCheck className="h-3 w-3" /> Aprovado</span>;
    case 'rejected':
      return <span className="inline-flex items-center gap-1 text-red-700 bg-red-100 px-2 py-1 rounded text-xs"><BadgeX className="h-3 w-3" /> Rejeitado</span>;
    case 'pending':
      return <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-100 px-2 py-1 rounded text-xs"><BadgeAlert className="h-3 w-3" /> Pendente</span>;
    case 'incomplete':
      return <span className="inline-flex items-center gap-1 text-gray-700 bg-gray-100 px-2 py-1 rounded text-xs"><Upload className="h-3 w-3" /> Incompleto</span>;
    default:
      return <span className="inline-flex items-center gap-1 text-gray-700 bg-gray-100 px-2 py-1 rounded text-xs">{status}</span>;
  }
};
