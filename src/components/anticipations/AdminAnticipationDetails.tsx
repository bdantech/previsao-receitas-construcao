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
import { Loader, CheckCircle, XCircle, Plus, FileEdit } from "lucide-react";
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCNPJ, formatCurrency } from "@/lib/formatters";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";

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

const paymentPlanSchema = z.object({
  diaCobranca: z.coerce.number()
    .min(1, { message: "Dia de cobrança deve ser entre 1 e 31" })
    .max(31, { message: "Dia de cobrança deve ser entre 1 e 31" }),
  tetoFundoReserva: z.coerce.number()
    .min(0, { message: "Teto do fundo de reserva deve ser um valor positivo" })
});

type PaymentPlanFormValues = z.infer<typeof paymentPlanSchema>;

export const AdminAnticipationDetails: React.FC<AdminAnticipationDetailsProps> = ({ anticipationId, onClose, onStatusUpdate }) => {
  const { session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [anticipation, setAnticipation] = useState<Anticipation | null>(null);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [creditInfo, setCreditInfo] = useState<{ available: number, requested: number } | null>(null);
  const [isPaymentPlanDialogOpen, setIsPaymentPlanDialogOpen] = useState(false);
  const [isCreatingPaymentPlan, setIsCreatingPaymentPlan] = useState(false);
  
  const form = useForm<PaymentPlanFormValues>({
    resolver: zodResolver(paymentPlanSchema),
    defaultValues: {
      diaCobranca: 10,
      tetoFundoReserva: 0
    }
  });
  
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
  
  const handleCreatePaymentPlan = async (values: PaymentPlanFormValues) => {
    if (!anticipation || !session?.access_token) return;
    
    try {
      setIsCreatingPaymentPlan(true);
      
      const { data, error } = await supabase.functions.invoke('admin-payment-plans', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          action: 'createPaymentPlan',
          anticipationRequestId: anticipation.id,
          diaCobranca: values.diaCobranca,
          tetoFundoReserva: values.tetoFundoReserva
        }
      });
      
      if (error) {
        console.error('Error creating payment plan:', error);
        toast({
          title: "Erro ao criar plano de pagamento",
          description: "Ocorreu um erro ao criar o plano de pagamento.",
          variant: "destructive"
        });
        return;
      }
      
      toast({
        title: "Plano de pagamento criado",
        description: "O plano de pagamento foi criado com sucesso.",
        variant: "default"
      });
      
      setIsPaymentPlanDialogOpen(false);
      
      if (data && data.id) {
        navigate(`/admin/payment-plans/${data.id}`);
      }
    } catch (error) {
      console.error('Error creating payment plan:', error);
      toast({
        title: "Erro ao criar plano de pagamento",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setIsCreatingPaymentPlan(false);
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
            <>
              <Button 
                className="bg-blue-500 text-white hover:bg-blue-600"
                onClick={() => handleStatusChange('Concluída')}
                disabled={isUpdating}
              >
                Concluir
                {isUpdating && <Loader className="ml-2 h-4 w-4 animate-spin" />}
              </Button>
              
              <Button 
                variant="default"
                onClick={() => setIsPaymentPlanDialogOpen(true)}
                className="flex items-center gap-1"
              >
                <FileEdit className="h-4 w-4" />
                Criar Plano de Pagamento
              </Button>
            </>
          )}
          
          {anticipation.status === 'Concluída' && (
            <Button 
              variant="default"
              onClick={() => setIsPaymentPlanDialogOpen(true)}
              className="flex items-center gap-1"
            >
              <FileEdit className="h-4 w-4" />
              Criar Plano de Pagamento
            </Button>
          )}
        </div>
      </div>
      
      <Dialog open={isPaymentPlanDialogOpen} onOpenChange={setIsPaymentPlanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Plano de Pagamento</DialogTitle>
            <DialogDescription>
              Defina os parâmetros para o plano de pagamento da antecipação.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreatePaymentPlan)} className="space-y-4">
              <FormField
                control={form.control}
                name="diaCobranca"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dia de Cobrança</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" max="31" {...field} />
                    </FormControl>
                    <FormDescription>
                      Dia do mês em que as cobranças serão realizadas (1-31).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="tetoFundoReserva"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teto do Fundo de Reserva</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" {...field} />
                    </FormControl>
                    <FormDescription>
                      Valor máximo para o fundo de reserva.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsPaymentPlanDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isCreatingPaymentPlan}>
                  {isCreatingPaymentPlan ? (
                    <>
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>Criar Plano</>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
