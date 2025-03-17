
import React, { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Loader, CheckCircle, XCircle } from "lucide-react";
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCNPJ, formatCurrency } from "@/lib/formatters";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

interface Company {
  name: string;
  cnpj: string;
}

interface Project {
  name: string;
}

interface Receivable {
  id: string;
  buyer_name: string;
  buyer_cpf: string;
  amount: number;
  due_date: string;
  description: string;
  status: string;
}

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
  companies: Company;
  projects: Project;
  taxa_juros_180?: number;
  taxa_juros_360?: number;
  taxa_juros_720?: number;
  taxa_juros_longo_prazo?: number;
  tarifa_por_recebivel?: number;
}

interface AdminAnticipationDetailsProps {
  anticipationId: string;
  onClose: () => void;
  onStatusUpdate?: () => void;
}

export const AdminAnticipationDetails: React.FC<AdminAnticipationDetailsProps> = ({ anticipationId, onClose, onStatusUpdate }) => {
  const { session } = useAuth();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [anticipation, setAnticipation] = useState<Anticipation | null>(null);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [creditInfo, setCreditInfo] = useState<{ available: number, requested: number } | null>(null);
  
  const fetchAnticipationDetails = async () => {
    if (!session?.access_token) return;
    
    try {
      setIsLoading(true);
      setErrorMessage(null);
      
      const { data, error } = await supabase.functions.invoke('admin-anticipations', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          action: 'getAnticipationDetails',
          anticipationId: anticipationId
        }
      });
      
      if (error) throw error;
      
      setAnticipation(data.anticipation);
      setReceivables(data.receivables);
    } catch (error) {
      console.error('Error fetching anticipation details:', error);
      toast({
        title: "Erro ao carregar detalhes",
        description: "Não foi possível obter os detalhes da antecipação.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchAnticipationDetails();
  }, [session, anticipationId]);
  
  const handleStatusChange = async (newStatus: string) => {
    setIsUpdating(true);
    setErrorMessage(null);
    setCreditInfo(null);
    
    try {
      if (!session?.access_token) {
        throw new Error("No authentication token available");
      }
      
      const { data, error } = await supabase.functions.invoke("admin-anticipations", {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          action: "updateAnticipationStatus",
          anticipationId: anticipationId,
          newStatus: newStatus
        }
      });
      
      if (error) {
        console.error("Error updating anticipation status:", error);
        toast({
          title: "Erro ao atualizar status",
          description: "Ocorreu um erro ao tentar atualizar o status.",
          variant: "destructive"
        });
        setIsUpdating(false);
        return;
      }
      
      if (data.error) {
        console.error("Server reported an error:", data.error);
        
        // Handle credit limit error specifically
        if (data.details && data.error === "Limite de crédito insuficiente") {
          setErrorMessage(data.details.message);
          setCreditInfo({
            available: data.details.availableCredit,
            requested: data.details.requestedAmount
          });
          toast({
            title: "Limite de crédito insuficiente",
            description: "Não há limite de crédito disponível para esta antecipação.",
            variant: "destructive"
          });
          setIsUpdating(false);
          return;
        } else {
          // Handle other errors
          setErrorMessage(data.error);
          toast({
            title: "Erro ao atualizar status",
            description: data.error,
            variant: "destructive"
          });
          setIsUpdating(false);
          return;
        }
      }
      
      toast({
        title: "Status atualizado",
        description: `Antecipação agora está ${newStatus}`,
        variant: "default"
      });
      
      // Reload anticipation details
      fetchAnticipationDetails();
      
      if (onStatusUpdate) {
        onStatusUpdate();
      }
    } catch (error) {
      console.error("Error updating anticipation status:", error);
      toast({
        title: "Erro ao atualizar status",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };
  
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
      <div className="fixed inset-0 bg-gray-500 bg-opacity-50 z-50 flex items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }
  
  if (!anticipation) {
    return (
      <div className="fixed inset-0 bg-gray-500 bg-opacity-50 z-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-md">
          <p className="text-lg font-semibold">Antecipação não encontrada.</p>
          <Button variant="outline" className="mt-4" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-md max-w-3xl w-full overflow-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">Detalhes da Antecipação</h2>
          <Button variant="outline" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </div>
        
        {/* Error message section */}
        {errorMessage && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Erro ao aprovar antecipação</AlertTitle>
            <AlertDescription>
              {errorMessage}
              {creditInfo && (
                <div className="mt-2">
                  <p>Limite disponível: {formatCurrency(creditInfo.available)}</p>
                  <p>Valor solicitado: {formatCurrency(creditInfo.requested)}</p>
                  <p>Diferença: {formatCurrency(creditInfo.requested - creditInfo.available)}</p>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-gray-500">
              Data de Criação: {format(new Date(anticipation.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })} ({formatDistanceToNow(new Date(anticipation.created_at), { locale: ptBR, addSuffix: true })})
            </p>
            <p className="text-gray-500">
              Empresa: {anticipation.companies?.name} ({anticipation.companies?.cnpj ? formatCNPJ(anticipation.companies.cnpj) : ''})
            </p>
            <p className="text-gray-500">Projeto: {anticipation.projects?.name}</p>
            <p className="text-gray-500">Status: {getStatusBadge(anticipation.status)}</p>
          </div>
          
          <div>
            <p className="text-right text-lg font-semibold">Valor Total: {formatCurrency(anticipation.valor_total)}</p>
            <p className="text-right text-lg font-semibold">Valor Líquido: {formatCurrency(anticipation.valor_liquido)}</p>
            <p className="text-right text-gray-500">Quantidade de Recebíveis: {anticipation.quantidade_recebiveis}</p>
          </div>
        </div>
        
        {/* New section for interest rates and fees */}
        <div className="mt-4 bg-gray-50 p-4 rounded-md">
          <h3 className="text-md font-semibold mb-2">Taxas e Tarifas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <p className="text-sm text-gray-500">Taxa até 180 dias:</p>
              <p className="font-medium">{anticipation.taxa_juros_180 !== undefined ? `${anticipation.taxa_juros_180}% a.m.` : 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Taxa até 360 dias:</p>
              <p className="font-medium">{anticipation.taxa_juros_360 !== undefined ? `${anticipation.taxa_juros_360}% a.m.` : 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Taxa até 720 dias:</p>
              <p className="font-medium">{anticipation.taxa_juros_720 !== undefined ? `${anticipation.taxa_juros_720}% a.m.` : 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Taxa longo prazo:</p>
              <p className="font-medium">{anticipation.taxa_juros_longo_prazo !== undefined ? `${anticipation.taxa_juros_longo_prazo}% a.m.` : 'N/A'}</p>
            </div>
          </div>
          <div className="mt-2">
            <p className="text-sm text-gray-500">Tarifa por recebível:</p>
            <p className="font-medium">{anticipation.tarifa_por_recebivel !== undefined ? formatCurrency(anticipation.tarifa_por_recebivel) : 'N/A'}</p>
          </div>
        </div>
        
        <div className="mt-6">
          <h3 className="text-xl font-semibold mb-2">Recebíveis Associados</h3>
          {receivables.length === 0 ? (
            <p className="text-gray-500">Nenhum recebível associado a esta antecipação.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Data de Vencimento</th>
                    <th className="text-left py-2 px-3 font-medium">Comprador</th>
                    <th className="text-right py-2 px-3 font-medium">Valor</th>
                    <th className="text-left py-2 px-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {receivables.map((receivable) => (
                    <tr key={receivable.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-3">
                        {format(new Date(receivable.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </td>
                      <td className="py-2 px-3">{receivable.buyer_name}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(receivable.amount)}</td>
                      <td className="py-2 px-3">{receivable.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {/* Status Update Actions */}
        <div className="mt-8 flex justify-end gap-4">
          {anticipation.status === 'Solicitada' && (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isUpdating}>
                    Reprovar
                    {isUpdating && <Loader className="ml-2 h-4 w-4 animate-spin" />}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Essa ação irá reprovar a antecipação. Tem certeza que deseja continuar?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleStatusChange('Reprovada')} disabled={isUpdating}>
                      Confirmar
                      {isUpdating && <Loader className="ml-2 h-4 w-4 animate-spin" />}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              
              <Button 
                variant="success" 
                onClick={() => handleStatusChange('Aprovada')} 
                disabled={isUpdating}
              >
                Aprovar
                {isUpdating && <Loader className="ml-2 h-4 w-4 animate-spin" />}
              </Button>
            </>
          )}
          
          {anticipation.status === 'Aprovada' && (
            <Button 
              className="bg-blue-500 text-white hover:bg-blue-600"
              onClick={() => handleStatusChange('Concluída')}
              disabled={isUpdating}
            >
              Concluir
              {isUpdating && <Loader className="ml-2 h-4 w-4 animate-spin" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
