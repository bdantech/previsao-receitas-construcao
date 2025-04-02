
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PaymentPlan, PaymentPlanInstallment } from "@/hooks/useProjectPaymentPlans";
import { formatCurrency } from "@/lib/formatters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, FileText, Info } from "lucide-react";
import { Loader } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PaymentPlansTableProps {
  paymentPlans: PaymentPlan[];
  selectedPlan: PaymentPlan | null;
  isLoading: boolean;
  onSelectPlan: (planId: string) => void;
}

const PaymentPlansTable: React.FC<PaymentPlansTableProps> = ({
  paymentPlans,
  selectedPlan,
  isLoading,
  onSelectPlan,
}) => {
  const [activeTab, setActiveTab] = useState("info");
  const [installmentDetailsOpen, setInstallmentDetailsOpen] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<PaymentPlanInstallment | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (paymentPlans.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500">Nenhum plano de pagamento encontrado para este projeto.</p>
      </div>
    );
  }

  const handlePlanChange = (planId: string) => {
    onSelectPlan(planId);
  };

  const viewInstallmentDetails = (installment: PaymentPlanInstallment) => {
    setSelectedInstallment(installment);
    setInstallmentDetailsOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="w-full md:w-64">
          <Select
            value={selectedPlan?.id}
            onValueChange={handlePlanChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um plano" />
            </SelectTrigger>
            <SelectContent>
              {paymentPlans.map((plan) => (
                <SelectItem key={plan.id} value={plan.id}>
                  Plano {format(new Date(plan.created_at), "dd/MM/yyyy")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedPlan && (
        <Card>
          <CardHeader>
            <CardTitle>Detalhes do Plano de Pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4 bg-white">
                <TabsTrigger value="info" className="flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Informações
                </TabsTrigger>
                <TabsTrigger value="installments" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Parcelas
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Valor da Antecipação</h4>
                    <p className="text-lg font-medium">
                      {formatCurrency(selectedPlan.anticipation_requests.valor_total)}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Valor Líquido</h4>
                    <p className="text-lg font-medium">
                      {formatCurrency(selectedPlan.anticipation_requests.valor_liquido)}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Dia de Cobrança</h4>
                    <p className="text-lg font-medium">Dia {selectedPlan.dia_cobranca}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Teto do Fundo de Reserva</h4>
                    <p className="text-lg font-medium">
                      {formatCurrency(selectedPlan.teto_fundo_reserva)}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Status da Antecipação</h4>
                    <p className="text-lg font-medium">
                      {selectedPlan.anticipation_requests.status}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500">Data de Criação</h4>
                    <p className="text-lg font-medium">
                      {format(new Date(selectedPlan.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="installments">
                {selectedPlan.payment_plan_installments && selectedPlan.payment_plan_installments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Parcela</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Recebíveis</TableHead>
                          <TableHead>PMT</TableHead>
                          <TableHead>Saldo Devedor</TableHead>
                          <TableHead>Fundo Reserva</TableHead>
                          <TableHead>Devolução</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedPlan.payment_plan_installments.map((installment) => (
                          <TableRow key={installment.id}>
                            <TableCell>{installment.numero_parcela}</TableCell>
                            <TableCell>
                              {format(new Date(installment.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}
                            </TableCell>
                            <TableCell>{formatCurrency(installment.recebiveis)}</TableCell>
                            <TableCell>{formatCurrency(installment.pmt)}</TableCell>
                            <TableCell>{formatCurrency(installment.saldo_devedor)}</TableCell>
                            <TableCell>{formatCurrency(installment.fundo_reserva)}</TableCell>
                            <TableCell>{formatCurrency(installment.devolucao)}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => viewInstallmentDetails(installment)}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Detalhes
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">
                    Nenhuma parcela encontrada para este plano.
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <Dialog open={installmentDetailsOpen} onOpenChange={setInstallmentDetailsOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Detalhes da Parcela</DialogTitle>
          </DialogHeader>
          {selectedInstallment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Número da Parcela</h4>
                  <p className="text-lg font-medium">{selectedInstallment.numero_parcela}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Data de Vencimento</h4>
                  <p className="text-lg font-medium">
                    {format(new Date(selectedInstallment.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Recebíveis</h4>
                  <p className="text-lg font-medium">{formatCurrency(selectedInstallment.recebiveis)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">PMT</h4>
                  <p className="text-lg font-medium">{formatCurrency(selectedInstallment.pmt)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Saldo Devedor</h4>
                  <p className="text-lg font-medium">{formatCurrency(selectedInstallment.saldo_devedor)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Fundo de Reserva</h4>
                  <p className="text-lg font-medium">{formatCurrency(selectedInstallment.fundo_reserva)}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Devolução</h4>
                  <p className="text-lg font-medium">{formatCurrency(selectedInstallment.devolucao)}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentPlansTable;
