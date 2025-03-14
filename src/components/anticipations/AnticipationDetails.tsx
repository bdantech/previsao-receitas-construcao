import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader, ArrowLeft, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCPF, formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface Anticipation {
  id: string;
  company_id: string;
  project_id: string;
  valor_total: number;
  valor_liquido: number;
  status: string;
  quantidade_recebiveis: number;
  created_at: string;
  updated_at: string;
  taxa_juros_180: number;
  taxa_juros_360: number;
  taxa_juros_720: number;
  taxa_juros_longo_prazo: number;
  tarifa_por_recebivel: number;
  projects?: {
    name: string;
    cnpj: string;
  };
  companies?: {
    name: string;
    cnpj: string;
  };
}

interface Receivable {
  id: string;
  buyer_name?: string;
  buyer_cpf: string;
  amount: number;
  due_date: string;
  description?: string;
  status: string;
}

const AnticipationDetails = () => {
  const { projectId, anticipationId } = useParams<{ projectId: string; anticipationId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [anticipation, setAnticipation] = useState<Anticipation | null>(null);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  
  // Fetch anticipation details
  useEffect(() => {
    const fetchAnticipationDetails = async () => {
      if (!session?.access_token || !anticipationId) return;
      
      try {
        setIsLoading(true);
        
        // Get anticipation details using the SQL function directly
        const { data: detailsData, error: detailsError } = await supabase
          .rpc('get_anticipation_details', {
            p_anticipation_id: anticipationId
          });
        
        if (detailsError) {
          console.error('Error fetching anticipation details:', detailsError);
          throw detailsError;
        }
        
        if (!detailsData || !detailsData.anticipation) {
          throw new Error('Antecipação não encontrada');
        }
        
        setAnticipation(detailsData.anticipation);
        setReceivables(detailsData.receivables || []);
      } catch (error) {
        console.error('Error fetching anticipation details:', error);
        toast({
          title: "Erro ao carregar detalhes da antecipação",
          description: "Não foi possível obter os detalhes da antecipação solicitada.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAnticipationDetails();
  }, [session, anticipationId, toast]);
  
  // Get status badge
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
  
  // Handle back button
  const handleBack = () => {
    navigate(`/project-dashboard/${projectId}?tab=antecipacoes`);
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }
  
  if (!anticipation) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-10">
          <h3 className="text-lg font-medium mb-2">Antecipação não encontrada</h3>
          <p className="text-gray-500 mb-6">
            A antecipação solicitada não foi encontrada ou você não tem permissão para acessá-la.
          </p>
          <Button 
            variant="outline" 
            onClick={handleBack}
            className="flex items-center gap-2 mx-auto"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container max-w-5xl mx-auto py-8">
      <div className="mb-6 flex items-center gap-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <h1 className="text-2xl font-bold">Detalhes da Antecipação</h1>
        {getStatusBadge(anticipation.status)}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Informações Gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-gray-500">ID da Antecipação</div>
              <div className="font-medium">{anticipation.id}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Data da Solicitação</div>
              <div className="font-medium">
                {format(new Date(anticipation.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Última Atualização</div>
              <div className="font-medium">
                {format(new Date(anticipation.updated_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Projeto</div>
              <div className="font-medium">{anticipation.projects?.name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Empresa</div>
              <div className="font-medium">{anticipation.companies?.name}</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Valores e Taxas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">Valor Total</div>
                <div className="text-xl font-semibold">{formatCurrency(anticipation.valor_total)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Valor Líquido</div>
                <div className="text-xl font-semibold text-primary">{formatCurrency(anticipation.valor_liquido)}</div>
              </div>
            </div>
            
            <div>
              <div className="text-sm text-gray-500 mb-2">Taxas Aplicadas</div>
              <div className="bg-gray-50 p-3 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Taxa até 180 dias:</span>
                  <span className="font-medium">{anticipation.taxa_juros_180}% a.m.</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxa até 360 dias:</span>
                  <span className="font-medium">{anticipation.taxa_juros_360}% a.m.</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxa até 720 dias:</span>
                  <span className="font-medium">{anticipation.taxa_juros_720}% a.m.</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxa longo prazo:</span>
                  <span className="font-medium">{anticipation.taxa_juros_longo_prazo}% a.m.</span>
                </div>
                <div className="flex justify-between">
                  <span>Tarifa por recebível:</span>
                  <span className="font-medium">{formatCurrency(anticipation.tarifa_por_recebivel)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recebíveis Antecipados</CardTitle>
            <CardDescription>
              {anticipation.quantidade_recebiveis} recebíveis associados a esta antecipação
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {receivables.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Nenhum recebível encontrado para esta antecipação.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Comprador</th>
                    <th className="text-left py-3 px-4 font-medium">CPF</th>
                    <th className="text-left py-3 px-4 font-medium">Vencimento</th>
                    <th className="text-right py-3 px-4 font-medium">Valor</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-left py-3 px-4 font-medium">Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  {receivables.map((receivable) => (
                    <tr key={receivable.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{receivable.buyer_name || "—"}</td>
                      <td className="py-3 px-4">{formatCPF(receivable.buyer_cpf)}</td>
                      <td className="py-3 px-4">
                        {format(new Date(receivable.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </td>
                      <td className="py-3 px-4 text-right">{formatCurrency(receivable.amount)}</td>
                      <td className="py-3 px-4">
                        {receivable.status === 'antecipado' ? (
                          <Badge className="bg-blue-500">Antecipado</Badge>
                        ) : (
                          <Badge variant="secondary">{receivable.status}</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate" title={receivable.description}>
                        {receivable.description || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button 
            variant="outline" 
            onClick={handleBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default AnticipationDetails;
