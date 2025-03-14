
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader, Plus, ReceiptText, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface Anticipation {
  id: string;
  valor_total: number;
  valor_liquido: number;
  status: string;
  quantidade_recebiveis: number;
  created_at: string;
  updated_at: string;
  projects?: {
    name: string;
  };
}

interface AnticipationsListProps {
  projectId: string;
}

const AnticipationsList = ({ projectId }: AnticipationsListProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [anticipations, setAnticipations] = useState<Anticipation[]>([]);
  
  // Fetch anticipations
  useEffect(() => {
    const fetchAnticipations = async () => {
      if (!session?.access_token || !projectId) return;
      
      try {
        setIsLoading(true);
        
        // Get project to get company ID
        const { data: projectData } = await supabase.functions.invoke('project-management', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: {
            method: 'GET',
            endpoint: `projects/${projectId}`
          }
        });
        
        if (!projectData || !projectData.project) {
          throw new Error('Project not found');
        }
        
        const companyId = projectData.project.company_id;
        
        // Get anticipations
        const response = await supabase.functions.invoke('company-anticipations', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: {
            action: 'getAnticipations',
            companyId
          }
        });
        
        if (response.error) {
          throw response.error;
        }
        
        // Filter anticipations by project ID
        const projectAnticipations = response.data?.anticipations.filter(
          (ant: Anticipation) => ant.project_id === projectId
        ) || [];
        
        setAnticipations(projectAnticipations);
      } catch (error) {
        console.error('Error fetching anticipations:', error);
        toast({
          title: "Erro ao carregar antecipações",
          description: "Não foi possível obter a lista de antecipações deste projeto.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAnticipations();
  }, [session, projectId, toast]);
  
  // Redirect to create anticipation page
  const handleCreateAnticipation = () => {
    navigate(`/project-dashboard/${projectId}/create-anticipation`);
  };
  
  // View anticipation details
  const handleViewAnticipation = (anticipationId: string) => {
    navigate(`/project-dashboard/${projectId}/anticipation/${anticipationId}`);
  };
  
  // Get status badge color
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Solicitada':
        return <Badge variant="warning">Solicitada</Badge>;
      case 'Aprovada':
        return <Badge variant="success">Aprovada</Badge>;
      case 'Reprovada':
        return <Badge variant="destructive">Reprovada</Badge>;
      case 'Concluída':
        return <Badge className="bg-blue-500">Concluída</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Antecipações</CardTitle>
        <Button onClick={handleCreateAnticipation} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Solicitar Antecipação
        </Button>
      </CardHeader>
      <CardContent>
        {anticipations.length === 0 ? (
          <div className="text-center py-10">
            <ReceiptText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma antecipação solicitada</h3>
            <p className="text-gray-500 mb-6">
              Você ainda não solicitou nenhuma antecipação para este projeto.
            </p>
            <Button 
              variant="outline" 
              onClick={handleCreateAnticipation}
              className="flex items-center gap-2 mx-auto"
            >
              <Plus className="h-4 w-4" />
              Solicitar Primeira Antecipação
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Data</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                  <th className="text-right py-3 px-4 font-medium">Valor Total</th>
                  <th className="text-right py-3 px-4 font-medium">Valor Líquido</th>
                  <th className="text-center py-3 px-4 font-medium">Recebíveis</th>
                  <th className="text-right py-3 px-4 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {anticipations.map((anticipation) => (
                  <tr key={anticipation.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      {format(new Date(anticipation.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(anticipation.status)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {formatCurrency(anticipation.valor_total)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {formatCurrency(anticipation.valor_liquido)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {anticipation.quantidade_recebiveis}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex items-center gap-1"
                        onClick={() => handleViewAnticipation(anticipation.id)}
                      >
                        <ExternalLink className="h-4 w-4" />
                        Detalhes
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AnticipationsList;
