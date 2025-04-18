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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatCPF, formatCurrency } from "@/lib/formatters";
import { ArrowLeft, Check, Edit, Loader, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";

interface PaymentPlan {
  id: string;
  dia_cobranca: number;
  teto_fundo_reserva: number;
  anticipation_request_id: string;
  project_id: string;
  created_at: string;
  updated_at: string;
  index_id?: string;
  adjustment_base_date?: string;
  anticipation_requests: {
    valor_total: number;
    valor_liquido: number;
    status: string;
  };
  projects: {
    name: string;
    cnpj: string;
  };
  indexes?: {
    id: string;
    name: string;
  };
  payment_plan_installments: PaymentPlanInstallment[];
}

interface PaymentPlanInstallment {
  id: string;
  numero_parcela: number;
  data_vencimento: string;
  recebiveis: number;
  pmt: number;
  saldo_devedor: number;
  fundo_reserva: number;
  devolucao: number;
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

interface PmtReceivable {
  id: string;
  receivable_id: string;
  receivables: Receivable;
}

interface BillingReceivable {
  id: string;
  receivable_id: string;
  nova_data_vencimento?: string;
  receivables: Receivable;
}

interface ReceivableMap {
  pmt: PmtReceivable[];
  billing: BillingReceivable[];
}

interface ReceivableSummary {
  totalSelected: number;
  installmentAmount: number;
  difference: number;
}

interface Index {
  id: string;
  name: string;
}

interface AdjustmentFormValues {
  indexId: string;
  adjustmentBaseDate: string;
}

const AdminPaymentPlanDetailPage = () => {
  const { paymentPlanId } = useParams();
  const { session, userRole } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan | null>(null);
  const [selectedInstallment, setSelectedInstallment] = useState<PaymentPlanInstallment | null>(null);
  const [receivableMap, setReceivableMap] = useState<ReceivableMap>({
    pmt: [],
    billing: []
  });
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isReceivablesDialogOpen, setIsReceivablesDialogOpen] = useState(false);
  const [isAddBillingReceivablesOpen, setIsAddBillingReceivablesOpen] = useState(false);
  const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState(false);
  const [eligibleReceivables, setEligibleReceivables] = useState<Receivable[]>([]);
  const [selectedReceivableIds, setSelectedReceivableIds] = useState<string[]>([]);
  const [loadingEligibleReceivables, setLoadingEligibleReceivables] = useState(false);
  const [updatingBillingReceivables, setUpdatingBillingReceivables] = useState(false);
  const [removingBillingReceivable, setRemovingBillingReceivable] = useState<string | null>(null);
  const [receivableSummary, setReceivableSummary] = useState<ReceivableSummary>({
    totalSelected: 0,
    installmentAmount: 0,
    difference: 0
  });
  const [indexes, setIndexes] = useState<Index[]>([]);
  const [updatingAdjustment, setUpdatingAdjustment] = useState(false);
  
  const form = useForm<AdjustmentFormValues>({
    defaultValues: {
      indexId: '',
      adjustmentBaseDate: ''
    }
  });

  useEffect(() => {
    if (session && userRole === 'admin' && paymentPlanId) {
      fetchPaymentPlanDetails();
      fetchIndexes();
    }
  }, [session, userRole, paymentPlanId]);

  useEffect(() => {
    if (paymentPlan) {
      form.reset({
        indexId: paymentPlan.index_id || '',
        adjustmentBaseDate: paymentPlan.adjustment_base_date || ''
      });
    }
  }, [paymentPlan, form]);

  useEffect(() => {
    if (eligibleReceivables.length > 0 && selectedInstallment) {
      const totalSelected = eligibleReceivables
        .filter(receivable => selectedReceivableIds.includes(receivable.id))
        .reduce((sum, receivable) => sum + receivable.amount, 0);
      
      const installmentAmount = selectedInstallment ? selectedInstallment.pmt : 0;
      
      setReceivableSummary({
        totalSelected,
        installmentAmount,
        difference: totalSelected - installmentAmount
      });
    }
  }, [selectedReceivableIds, eligibleReceivables, selectedInstallment]);

  const fetchPaymentPlanDetails = async () => {
    if (!session || !paymentPlanId) return;
  
    try {
      setLoading(true);
  
      const { data, error } = await supabase.functions.invoke('admin-payment-plans', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          action: 'getPaymentPlanDetails',
          paymentPlanId
        }
      });
  
      if (error) {
        console.error("Error fetching payment plan details:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível carregar os detalhes do plano de pagamento."
        });
        return;
      }
  
      if (!data?.data) {
        console.error("No payment plan data returned:", data);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Plano de pagamento não encontrado."
        });
        return;
      }
  
      if (data.data.payment_plan_installments) {
        data.data.payment_plan_installments.sort((a, b) => a.numero_parcela - b.numero_parcela);
      }
  
      setPaymentPlan(data.data);
  
      if (!data.data.payment_plan_installments || data.data.payment_plan_installments.length === 0) {
        console.warn("Payment plan has no installments:", data.data);
        toast({
          variant: "warning",
          title: "Atenção",
          description: "Este plano de pagamento não possui parcelas."
        });
        return;
      }
  
      console.log("Payment plan loaded with installments:", data.data.payment_plan_installments);
  
      // Apenas definir a primeira parcela se selectedInstallment ainda não estiver definida
      if (!selectedInstallment) {
        const firstInstallment = data.data.payment_plan_installments[0];
        setSelectedInstallment(firstInstallment);
        await fetchInstallmentReceivables(firstInstallment.id);
      } else {
        // Recarregar os recebíveis da parcela atualmente selecionada
        await fetchInstallmentReceivables(selectedInstallment.id);
      }
    } catch (error) {
      console.error("Exception fetching payment plan details:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao carregar detalhes do plano de pagamento."
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchInstallmentReceivables = async (installmentId: string) => {
    if (!session || !installmentId) {
      console.error("Missing session or installment ID for fetchInstallmentReceivables");
      return;
    }
    
    try {
      console.log(`Fetching receivables for installment: ${installmentId}`);
      
      const { data, error } = await supabase.functions.invoke('admin-payment-plans', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          action: 'getInstallmentReceivables',
          installmentId
        }
      });
      
      if (error) {
        console.error("Error fetching installment receivables:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: `Erro ao carregar recebíveis: ${error.message}`
        });
        return;
      }
      
      if (!data?.data) {
        console.warn("No receivables data returned:", data);
        toast({
          variant: "warning", 
          title: "Atenção",
          description: "Nenhum dado de recebíveis retornado pelo servidor."
        });
        setReceivableMap({
          pmt: [],
          billing: []
        });
        return;
      }
      
      console.log("Receivables loaded:", data.data);
      
      setReceivableMap({
        pmt: data.data.pmtReceivables || [],
        billing: data.data.billingReceivables || []
      });
    } catch (error) {
      console.error("Exception fetching installment receivables:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: `Erro ao carregar recebíveis: ${error.message || 'Erro desconhecido'}`
      });
    }
  };

  const fetchEligibleBillingReceivables = async () => {
    if (!paymentPlanId || !selectedInstallment) return;
    
    try {
      setLoadingEligibleReceivables(true);
      
      console.log(`Verifying installment: ${selectedInstallment.id}`);
      
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('admin-payment-plans', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        },
        body: {
          action: 'getInstallmentReceivables',
          installmentId: selectedInstallment.id
        }
      });
      
      if (verifyError) {
        console.error("Error verifying installment:", verifyError);
        toast({
          variant: "destructive",
          title: "Erro",
          description: `A parcela selecionada não pode ser verificada: ${verifyError.message}`
        });
        return;
      }
      
      const { data, error } = await supabase.functions.invoke('admin-payment-plans', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        },
        body: {
          action: 'getEligibleBillingReceivables',
          paymentPlanId,
          installmentId: selectedInstallment.id
        }
      });
      
      if (error) {
        console.error("Error fetching eligible receivables:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: `Não foi possível carregar os recebíveis elegíveis: ${error.message}`
        });
        return;
      }
      
      if (!data || !data.data) {
        console.warn("No eligible receivables data returned:", data);
        toast({
          variant: "warning",
          title: "Atenção",
          description: "Nenhum recebível elegível encontrado para esta parcela."
        });
        setEligibleReceivables([]);
        return;
      }
      
      console.log("Eligible receivables loaded:", data.data);
      setEligibleReceivables(data.data || []);
      setSelectedReceivableIds([]);
    } catch (error) {
      console.error("Exception in fetchEligibleBillingReceivables:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: `Erro ao carregar recebíveis elegíveis: ${error.message || 'Erro desconhecido'}`
      });
    } finally {
      setLoadingEligibleReceivables(false);
    }
  };

  const handleDeletePaymentPlan = async () => {
    if (!paymentPlanId) return;
    
    try {
      setDeletingPlan(true);
      
      const { data, error } = await supabase.functions.invoke('admin-payment-plans', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        },
        body: {
          action: 'deletePaymentPlan',
          paymentPlanId
        }
      });
      
      if (error) {
        console.error("Error deleting payment plan:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível excluir o plano de pagamento."
        });
        return;
      }
      
      toast({
        title: "Sucesso",
        description: "Plano de pagamento excluído com sucesso."
      });
      
      navigate('/admin/payment-plans');
    } catch (error) {
      console.error("Error deleting payment plan:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível excluir o plano de pagamento."
      });
    } finally {
      setDeletingPlan(false);
      setIsDeleteConfirmOpen(false);
    }
  };

  const handleViewReceivables = async (installment: PaymentPlanInstallment) => {
    setSelectedInstallment(installment);
    await fetchInstallmentReceivables(installment.id);
    setIsReceivablesDialogOpen(true);
  };

  const handleAddBillingReceivables = async () => {
    if (!selectedInstallment) return;
    
    await fetchEligibleBillingReceivables();
    setIsAddBillingReceivablesOpen(true);
  };

  const handleToggleReceivableSelection = (receivableId: string) => {
    setSelectedReceivableIds(prevSelected => {
      if (prevSelected.includes(receivableId)) {
        return prevSelected.filter(id => id !== receivableId);
      } else {
        return [...prevSelected, receivableId];
      }
    });
  };

  const handleSelectAllReceivables = () => {
    if (selectedReceivableIds.length === eligibleReceivables.length) {
      setSelectedReceivableIds([]);
    } else {
      setSelectedReceivableIds(eligibleReceivables.map(receivable => receivable.id));
    }
  };

  const handleSaveBillingReceivables = async () => {
    if (!selectedInstallment) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Nenhuma parcela selecionada. Por favor, selecione uma parcela primeiro."
      });
      return;
    }
  
    if (selectedReceivableIds.length === 0) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Nenhum recebível selecionado. Por favor, selecione pelo menos um recebível."
      });
      return;
    }
  
    try {
      setUpdatingBillingReceivables(true);
  
      console.log(`Sending add-billing-receivables request for installment: ${selectedInstallment.id} with receivables: ${selectedReceivableIds.length}`);
  
      const { data, error } = await supabase.functions.invoke('add-billing-receivables', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        },
        body: {
          installmentId: selectedInstallment.id,
          receivableIds: selectedReceivableIds
        }
      });
  
      if (error) {
        console.error("Error updating billing receivables:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: `Não foi possível adicionar os recebíveis de cobrança: ${error.message}`
        });
        return;
      }
  
      if (!data) {
        console.error("No response data received");
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Resposta vazia do servidor. Verifique os logs para mais detalhes."
        });
        return;
      }
  
      console.log("Response from add-billing-receivables:", data);
  
      if (data.warning) {
        console.warn("Warning when updating billing receivables:", data.warning);
        toast({
          title: "Atenção",
          description: data.warning
        });
      } else {
        toast({
          title: "Sucesso",
          description: "Recebíveis de cobrança adicionados com sucesso."
        });
      }
  
      const billingReceivables = data.billingReceivables;
  
      if (!billingReceivables || !Array.isArray(billingReceivables)) {
        console.warn("Response missing billing receivables data:", data);
        toast({
          title: "Atenção",
          description: "Verifique se os recebíveis foram adicionados corretamente."
        });
      } else {
        console.log(`${billingReceivables.length} billing receivables created successfully`, billingReceivables);
      }
  
      setIsAddBillingReceivablesOpen(false);
  
      // Reabrir o diálogo de recebíveis com a mesma parcela
      await fetchInstallmentReceivables(selectedInstallment.id);
      await fetchPaymentPlanDetails();
      setIsReceivablesDialogOpen(true); // Reabre o diálogo
    } catch (error) {
      console.error("Exception updating billing receivables:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: `Não foi possível adicionar os recebíveis de cobrança: ${error.message || 'Erro desconhecido'}`
      });
    } finally {
      setUpdatingBillingReceivables(false);
    }
  };
  
  const handleRemoveBillingReceivable = async (billingReceivableId: string) => {
    if (!selectedInstallment) return;
  
    try {
      setRemovingBillingReceivable(billingReceivableId);
  
      const { data, error } = await supabase.functions.invoke('remove-billing-receivable', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        },
        body: {
          billingReceivableId
        }
      });
  
      if (error) {
        console.error("Error removing billing receivable:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível remover o recebível de cobrança."
        });
        return;
      }
  
      toast({
        title: "Sucesso",
        description: "Recebível de cobrança removido com sucesso."
      });
  
      // Reabrir o diálogo de recebíveis com a mesma parcela
      await fetchInstallmentReceivables(selectedInstallment.id);
      await fetchPaymentPlanDetails();
      setIsReceivablesDialogOpen(true); // Reabre o diálogo
    } catch (error) {
      console.error("Error removing billing receivable:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível remover o recebível de cobrança."
      });
    } finally {
      setRemovingBillingReceivable(null);
    }
  };

  const formatDate = (date: string) => {
    const spacer = '/'
    const day = date.slice(8, 10)
    const month = date.slice(5, 7)
    const year = date.slice(0, 4)
    return `${day}${spacer}${month}${spacer}${year}`
  };

  const handleAdjustmentSave = async (data: AdjustmentFormValues) => {
    if (!paymentPlanId) return;
    
    try {
      setUpdatingAdjustment(true);
      
      console.log("Updating payment plan settings with:", {
        paymentPlanId,
        indexId: data.indexId === 'none' ? null : data.indexId,
        adjustmentBaseDate: data.adjustmentBaseDate || null
      });
      
      const { data: response, error } = await supabase.functions.invoke('admin-payment-plans', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        },
        body: {
          action: 'updatePaymentPlanSettings',
          paymentPlanId,
          indexId: data.indexId === 'none' ? null : data.indexId,
          adjustmentBaseDate: data.adjustmentBaseDate || null
        }
      });
      
      if (error) {
        console.error("Error updating payment plan settings:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível atualizar as configurações de reajuste."
        });
        return;
      }
      
      toast({
        title: "Sucesso",
        description: "Configurações de reajuste atualizadas com sucesso."
      });
      
      await fetchPaymentPlanDetails();
      setIsAdjustmentDialogOpen(false);
    } catch (error) {
      console.error("Error updating payment plan settings:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao atualizar configurações de reajuste."
      });
    } finally {
      setUpdatingAdjustment(false);
    }
  };

  const fetchIndexes = async () => {
    if (!session) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('indexes-management', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          action: 'getIndexes'
        }
      });
      
      if (error) {
        console.error("Error fetching indexes:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível carregar os índices."
        });
        return;
      }
      
      if (data?.indexes) {
        setIndexes(data.indexes);
      }
    } catch (error) {
      console.error("Exception fetching indexes:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao carregar índices."
      });
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => navigate('/admin/payment-plans')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold">Detalhes do Plano de Pagamento</h2>
        </div>
        
        <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
          <AlertDialogTrigger asChild>
            <Button 
              variant="destructive"
              size="sm"
              className="flex items-center gap-1"
            >
              <Trash2 className="h-4 w-4" />
              Excluir Plano
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Plano de Pagamento</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este plano de pagamento? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeletePaymentPlan}
                disabled={deletingPlan}
              >
                {deletingPlan ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  'Excluir'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {loading ? (
        <div className="flex justify-center my-10">
          <Loader className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      ) : paymentPlan ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Informações do Plano</CardTitle>
                  <CardDescription>
                    Detalhes gerais do plano de pagamento
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex items-center gap-1"
                  onClick={() => setIsAdjustmentDialogOpen(true)}
                >
                  <Edit className="h-4 w-4" />
                  Configurar Reajuste
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Projeto</h4>
                  <p className="mt-1 text-lg">{paymentPlan.projects.name}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Dia de Cobrança</h4>
                  <p className="mt-1 text-lg">Dia {paymentPlan.dia_cobranca}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Teto do Fundo de Reserva</h4>
                  <p className="mt-1 text-lg">{formatCurrency(paymentPlan.teto_fundo_reserva)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Valor da Antecipação</h4>
                  <p className="mt-1 text-lg">{formatCurrency(paymentPlan.anticipation_requests.valor_total)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Status da Antecipação</h4>
                  <p className="mt-1 text-lg">{paymentPlan.anticipation_requests.status}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Criado em</h4>
                  <p className="mt-1 text-lg">{formatDate(paymentPlan.created_at)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Índice para Reajuste</h4>
                  <p className="mt-1 text-lg">
                    {paymentPlan.indexes ? paymentPlan.indexes.name : 'Não definido'}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Data Base para Reajuste</h4>
                  <p className="mt-1 text-lg">
                    {paymentPlan.adjustment_base_date 
                      ? formatDate(paymentPlan.adjustment_base_date) 
                      : 'Não definida'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Parcelas</CardTitle>
              <CardDescription>
                Lista de parcelas do plano de pagamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Recebíveis</TableHead>
                      <TableHead>PMT</TableHead>
                      <TableHead>Saldo Devedor</TableHead>
                      <TableHead>Fundo de Reserva</TableHead>
                      <TableHead>Devolução</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentPlan.payment_plan_installments.map((installment) => (
                      <TableRow key={installment.id}>
                        <TableCell className="font-medium">{installment.numero_parcela}</TableCell>
                        <TableCell>{formatDate(installment.data_vencimento)}</TableCell>
                        <TableCell>{formatCurrency(installment.recebiveis)}</TableCell>
                        <TableCell>{formatCurrency(installment.pmt)}</TableCell>
                        <TableCell>{formatCurrency(installment.saldo_devedor)}</TableCell>
                        <TableCell>{formatCurrency(installment.fundo_reserva)}</TableCell>
                        <TableCell>{formatCurrency(installment.devolucao)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewReceivables(installment)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Ver Recebíveis
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Dialog open={isReceivablesDialogOpen} onOpenChange={setIsReceivablesDialogOpen}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>
                  Recebíveis da Parcela {selectedInstallment?.numero_parcela} - {selectedInstallment ? formatDate(selectedInstallment.data_vencimento) : ''}
                </DialogTitle>
                <DialogDescription>
                  Detalhes dos recebíveis vinculados a esta parcela
                </DialogDescription>
              </DialogHeader>
              
              <div className="mt-4 space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-medium">Recebíveis de PMT ({receivableMap.pmt.length})</h4>
                  </div>
                  
                  {receivableMap.pmt.length > 0 ? (
                    <div className="overflow-x-auto border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Comprador</TableHead>
                            <TableHead>CPF</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {receivableMap.pmt.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.receivables.buyer_name}</TableCell>
                              <TableCell>{formatCPF(item.receivables.buyer_cpf)}</TableCell>
                              <TableCell>{formatCurrency(item.receivables.amount)}</TableCell>
                              <TableCell>{formatDate(item.receivables.due_date)}</TableCell>
                              <TableCell>{item.receivables.status}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">Nenhum recebível de PMT encontrado.</p>
                  )}
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-medium">Recebíveis de Cobrança ({receivableMap.billing.length})</h4>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="flex items-center gap-1"
                      onClick={handleAddBillingReceivables}
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar Recebíveis de Cobrança
                    </Button>
                  </div>
                  
                  {receivableMap.billing.length > 0 ? (
                    <div className="overflow-x-auto border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Comprador</TableHead>
                            <TableHead>CPF</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Vencimento Original</TableHead>
                            <TableHead>Nova Data Vencimento</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {receivableMap.billing.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.receivables.buyer_name}</TableCell>
                              <TableCell>{formatCPF(item.receivables.buyer_cpf)}</TableCell>
                              <TableCell>{formatCurrency(item.receivables.amount)}</TableCell>
                              <TableCell>{formatDate(item.receivables.due_date)}</TableCell>
                              <TableCell>
                                {item.nova_data_vencimento 
                                  ? formatDate(item.nova_data_vencimento) 
                                  : "Não definida"}
                              </TableCell>
                              <TableCell>{item.receivables.status}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-900"
                                  disabled={!!removingBillingReceivable}
                                  onClick={() => handleRemoveBillingReceivable(item.id)}
                                >
                                  {removingBillingReceivable === item.id ? (
                                    <Loader className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <X className="h-4 w-4" />
                                  )}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">Nenhum recebível de cobrança encontrado.</p>
                  )}
                </div>
              </div>
              
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Fechar</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddBillingReceivablesOpen} onOpenChange={setIsAddBillingReceivablesOpen}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>
                  Adicionar Recebíveis de Cobrança
                </DialogTitle>
                <DialogDescription>
                  Selecione os recebíveis que deseja vincular à parcela {selectedInstallment?.numero_parcela}
                </DialogDescription>
              </DialogHeader>
              
              {loadingEligibleReceivables ? (
                <div className="flex justify-center my-6">
                  <Loader className="h-8 w-8 animate-spin text-gray-500" />
                </div>
              ) : (
                <>
                  {eligibleReceivables.length > 0 ? (
                    <>
                      <div className="flex justify-between items-center mb-3">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleSelectAllReceivables}
                          className="flex items-center gap-1"
                        >
                          <Check className="h-4 w-4" />
                          {selectedReceivableIds.length === eligibleReceivables.length 
                            ? "Desmarcar Todos" 
                            : "Selecionar Todos"}
                        </Button>
                        
                        <div className="flex gap-4 text-sm">
                          <div>
                            <span className="font-medium">Total Selecionado:</span>{" "}
                            <span className={receivableSummary.totalSelected > 0 ? "text-green-600 font-medium" : "text-gray-500"}>
                              {formatCurrency(receivableSummary.totalSelected)}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Valor da Parcela (PMT):</span>{" "}
                            <span className="text-blue-600 font-medium">
                              {formatCurrency(receivableSummary.installmentAmount)}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Diferença:</span>{" "}
                            <span className={
                              receivableSummary.difference === 0 
                                ? "text-green-600 font-medium" 
                                : receivableSummary.difference < 0 
                                  ? "text-red-600 font-medium" 
                                  : "text-yellow-600 font-medium"
                            }>
                              {formatCurrency(receivableSummary.difference)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="overflow-y-auto max-h-96 border rounded-md">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">Selecionar</TableHead>
                              <TableHead>Comprador</TableHead>
                              <TableHead>CPF</TableHead>
                              <TableHead>Valor</TableHead>
                              <TableHead>Vencimento</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {eligibleReceivables.map((receivable) => (
                              <TableRow key={receivable.id} className="cursor-pointer hover:bg-gray-100">
                                <TableCell className="text-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedReceivableIds.includes(receivable.id)}
                                    onChange={() => handleToggleReceivableSelection(receivable.id)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                </TableCell>
                                <TableCell>{receivable.buyer_name}</TableCell>
                                <TableCell>{formatCPF(receivable.buyer_cpf)}</TableCell>
                                <TableCell>{formatCurrency(receivable.amount)}</TableCell>
                                <TableCell>{formatDate(receivable.due_date)}</TableCell>
                                <TableCell>{receivable.status}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      
                      <div className="mt-2 text-sm text-gray-500">
                        {selectedReceivableIds.length} recebíveis selecionados
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-gray-500">Não foram encontrados recebíveis elegíveis para vincular a esta parcela.</p>
                    </div>
                  )}
                </>
              )}
              
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddBillingReceivablesOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  disabled={selectedReceivableIds.length === 0 || updatingBillingReceivables}
                  onClick={handleSaveBillingReceivables}
                >
                  {updatingBillingReceivables ? (
                    <>
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Adicionar Recebíveis'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isAdjustmentDialogOpen} onOpenChange={setIsAdjustmentDialogOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Configurar Reajuste</DialogTitle>
                <DialogDescription>
                  Configure as opções de reajuste para este plano de pagamento.
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleAdjustmentSave)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="indexId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Índice para Reajuste</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um índice" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="z-50 pointer-events-auto">
                            <SelectItem value="none">Nenhum</SelectItem>
                            {indexes.map((index) => (
                              <SelectItem key={index.id} value={index.id}>
                                {index.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="adjustmentBaseDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Base para Reajuste</FormLabel>
                        <FormControl>
                          <div className="flex gap-2 items-center">
                            <Input
                              type="date"
                              value={field.value ? field.value : ""}
                              onChange={(e) => field.onChange(e.target.value)}
                              className="w-full"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsAdjustmentDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={updatingAdjustment}
                    >
                      {updatingAdjustment ? (
                        <>
                          <Loader className="mr-2 h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : 'Salvar'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <div className="flex justify-center my-10">
          <div className="text-center">
            <p className="text-gray-500 mb-4">Plano de pagamento não encontrado.</p>
            <Button onClick={() => navigate('/admin/payment-plans')}>
              Voltar para a lista
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminPaymentPlanDetailPage;
