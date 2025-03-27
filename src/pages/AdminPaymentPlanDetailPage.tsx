
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AdminDashboardLayout } from "@/components/dashboard/AdminDashboardLayout";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
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
import { Loader, ArrowLeft, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface PaymentPlan {
  id: string;
  dia_cobranca: number;
  teto_fundo_reserva: number;
  anticipation_request_id: string;
  project_id: string;
  created_at: string;
  updated_at: string;
  anticipation_requests: {
    valor_total: number;
    valor_liquido: number;
    status: string;
  };
  projects: {
    name: string;
    cnpj: string;
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

interface ReceiableMap {
  [key: string]: Receivable[];
}

const AdminPaymentPlanDetailPage = () => {
  const { paymentPlanId } = useParams();
  const { session, userRole } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan | null>(null);
  const [selectedInstallment, setSelectedInstallment] = useState<PaymentPlanInstallment | null>(null);
  const [receivableMap, setReceivableMap] = useState<ReceiableMap>({
    pmt: [],
    billing: []
  });
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isReceivablesDialogOpen, setIsReceivablesDialogOpen] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState(false);

  useEffect(() => {
    if (session && userRole === 'admin' && paymentPlanId) {
      fetchPaymentPlanDetails();
    }
  }, [session, userRole, paymentPlanId]);

  const fetchPaymentPlanDetails = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('admin-payment-plans', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`
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
      
      if (data) {
        setPaymentPlan(data.data);
      }
    } catch (error) {
      console.error("Error fetching payment plan details:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar os detalhes do plano de pagamento."
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchInstallmentReceivables = async (installmentId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-payment-plans', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`
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
          description: "Não foi possível carregar os recebíveis da parcela."
        });
        return;
      }
      
      if (data) {
        setReceivableMap({
          pmt: data.data.pmtReceivables.map((item: any) => item.receivables),
          billing: data.data.billingReceivables.map((item: any) => item.receivables)
        });
      }
    } catch (error) {
      console.error("Error fetching installment receivables:", error);
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy');
  };

  return (
    <AdminDashboardLayout>
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
              <CardTitle>Informações do Plano</CardTitle>
              <CardDescription>
                Detalhes gerais do plano de pagamento
              </CardDescription>
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
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Parcela
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Vencimento
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Recebíveis
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        PMT
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Saldo Devedor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fundo de Reserva
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Devolução
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paymentPlan.payment_plan_installments.map((installment) => (
                      <tr key={installment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {installment.numero_parcela}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(installment.data_vencimento)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatCurrency(installment.recebiveis)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatCurrency(installment.pmt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatCurrency(installment.saldo_devedor)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatCurrency(installment.fundo_reserva)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatCurrency(installment.devolucao)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewReceivables(installment)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Ver Recebíveis
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                  <h4 className="text-sm font-medium mb-2">Recebíveis de PMT ({receivableMap.pmt.length})</h4>
                  {receivableMap.pmt.length > 0 ? (
                    <div className="overflow-x-auto border rounded-md">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Comprador
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              CPF
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Valor
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Vencimento
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {receivableMap.pmt.map((receivable) => (
                            <tr key={receivable.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                {receivable.buyer_name}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                {receivable.buyer_cpf}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                {formatCurrency(receivable.amount)}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                {formatDate(receivable.due_date)}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                {receivable.status}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">Nenhum recebível de PMT encontrado.</p>
                  )}
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-2">Recebíveis de Faturamento ({receivableMap.billing.length})</h4>
                  {receivableMap.billing.length > 0 ? (
                    <div className="overflow-x-auto border rounded-md">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Comprador
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              CPF
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Valor
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Vencimento
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {receivableMap.billing.map((receivable) => (
                            <tr key={receivable.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                                {receivable.buyer_name}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                {receivable.buyer_cpf}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                {formatCurrency(receivable.amount)}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                {formatDate(receivable.due_date)}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                {receivable.status}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">Nenhum recebível de faturamento encontrado.</p>
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
    </AdminDashboardLayout>
  );
};

export default AdminPaymentPlanDetailPage;
