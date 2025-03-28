import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../integrations/supabase/client';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { formatCurrency } from '../lib/formatters';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { ptBR } from 'date-fns/locale';

const AdminPaymentPlanDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedInstallment, setSelectedInstallment] = useState(null);
  const [showBillingDialog, setShowBillingDialog] = useState(false);
  const [showEditIndexDialog, setShowEditIndexDialog] = useState(false);
  const [indexId, setIndexId] = useState<string | null>(null);
  const [adjustmentBaseDate, setAdjustmentBaseDate] = useState<string | null>(null);

  // Fetch payment plan details - using admin-payment-plans instead of company-payment-plans
  const { data: paymentPlan, isLoading, error } = useQuery({
    queryKey: ['paymentPlanDetails', id],
    queryFn: async () => {
      console.log('Fetching payment plan details with ID:', id);
      const { data, error } = await supabase.functions.invoke('admin-payment-plans', {
        body: { action: 'getPaymentPlanDetails', paymentPlanId: id },
      });
      
      if (error) {
        console.error('Error fetching payment plan details:', error);
        throw new Error(error.message);
      }
      
      console.log('Received payment plan details:', data);
      return data;
    },
    enabled: !!id,
  });

  // Fetch indexes for the select dropdown
  const { data: indexes } = useQuery({
    queryKey: ['indexes'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('indexes-management', {
        body: { action: 'getIndexesForSelect' },
      });
      
      if (error) throw new Error(error.message);
      return data;
    },
  });

  // Mutation for updating payment plan settings
  const updatePaymentPlanSettings = useMutation({
    mutationFn: async ({ indexId, adjustmentBaseDate }: { indexId: string | null, adjustmentBaseDate: string | null }) => {
      console.log('Updating payment plan settings:', { indexId, adjustmentBaseDate });
      
      const { data, error } = await supabase.functions.invoke('admin-payment-plans', {
        body: { 
          action: 'updatePaymentPlanSettings', 
          paymentPlanId: id,
          indexId,
          adjustmentBaseDate 
        },
      });
      
      if (error) {
        console.error('Error updating payment plan settings:', error);
        throw new Error(`Error updating payment plan settings: ${error.message}`);
      }
      
      return data;
    },
    onSuccess: () => {
      toast.success('Configurações de reajuste atualizadas com sucesso');
      queryClient.invalidateQueries({ queryKey: ['paymentPlanDetails', id] });
      setShowEditIndexDialog(false);
    },
    onError: (error) => {
      console.error('Error updating payment plan settings:', error);
      toast.error(`Erro ao atualizar configurações: ${error.message}`);
    }
  });

  // Open the receivables dialog for an installment
  const handleViewReceivables = (installment) => {
    setSelectedInstallment(installment);
    setShowBillingDialog(true);
  };

  // Open the edit index dialog
  const handleOpenEditIndexDialog = () => {
    // Set current values if they exist
    if (paymentPlan) {
      setIndexId(paymentPlan.index_id || 'none');
      setAdjustmentBaseDate(paymentPlan.adjustment_base_date || '');
    }
    setShowEditIndexDialog(true);
  };

  // Save the edit index changes
  const handleSaveIndexChanges = () => {
    updatePaymentPlanSettings.mutate({ 
      indexId: indexId === 'none' ? null : indexId, 
      adjustmentBaseDate: adjustmentBaseDate || null 
    });
  };

  if (isLoading) {
    return <div className="p-4">Carregando...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Erro: {error.message}</div>;
  }

  if (!paymentPlan) {
    return <div className="p-4">Plano de pagamento não encontrado</div>;
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Detalhes do Plano de Pagamento</h1>
        <div className="space-x-2">
          <Button 
            variant="outline" 
            onClick={handleOpenEditIndexDialog}
          >
            Configurar Reajuste
          </Button>
          <Button 
            variant="outline" 
            onClick={() => navigate('/admin/payment-plans')}
          >
            Voltar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações do Plano</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Empresa / Projeto</p>
              <p className="font-medium">{paymentPlan.projects?.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">CNPJ</p>
              <p className="font-medium">{paymentPlan.projects?.cnpj}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status da Antecipação</p>
              <Badge>{paymentPlan.anticipation_requests?.status}</Badge>
            </div>
            <div>
              <p className="text-sm text-gray-500">Dia de Cobrança</p>
              <p className="font-medium">{paymentPlan.dia_cobranca}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Teto Fundo Reserva</p>
              <p className="font-medium">{formatCurrency(paymentPlan.teto_fundo_reserva)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Valor Total da Antecipação</p>
              <p className="font-medium">{formatCurrency(paymentPlan.anticipation_requests?.valor_total)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Valor Líquido da Antecipação</p>
              <p className="font-medium">{formatCurrency(paymentPlan.anticipation_requests?.valor_liquido)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Índice de Reajuste</p>
              <p className="font-medium">
                {indexes?.find(i => i.id === paymentPlan.index_id)?.name || 'Nenhum'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Data Base para Reajuste</p>
              <p className="font-medium">
                {paymentPlan.adjustment_base_date 
                  ? format(new Date(paymentPlan.adjustment_base_date), 'dd/MM/yyyy')
                  : 'Não definida'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parcelas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Nº</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Recebíveis</TableHead>
                <TableHead className="text-right">PMT</TableHead>
                <TableHead className="text-right">Saldo Devedor</TableHead>
                <TableHead className="text-right">Fundo Reserva</TableHead>
                <TableHead className="text-right">Devolução</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentPlan.payment_plan_installments?.map((installment) => (
                <TableRow key={installment.id}>
                  <TableCell>{installment.numero_parcela}</TableCell>
                  <TableCell>{format(new Date(installment.data_vencimento), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="text-right">{formatCurrency(installment.recebiveis)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(installment.pmt)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(installment.saldo_devedor)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(installment.fundo_reserva)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(installment.devolucao)}</TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleViewReceivables(installment)}
                    >
                      Ver Recebíveis
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Billing Receivables Dialog */}
      {selectedInstallment && (
        <ReceivablesDialog 
          installmentId={selectedInstallment.id}
          installmentNumber={selectedInstallment.numero_parcela}
          dueDate={selectedInstallment.data_vencimento}
          open={showBillingDialog}
          onOpenChange={setShowBillingDialog}
        />
      )}

      {/* Edit Index Dialog */}
      <Dialog open={showEditIndexDialog} onOpenChange={setShowEditIndexDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Reajuste</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Índice de Reajuste</label>
              <Select value={indexId || 'none'} onValueChange={setIndexId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um índice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {indexes?.map(index => (
                    <SelectItem key={index.id} value={index.id}>{index.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Data Base para Reajuste</label>
              <Input 
                type="date" 
                value={adjustmentBaseDate || ''} 
                onChange={(e) => setAdjustmentBaseDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button 
              onClick={handleSaveIndexChanges}
              disabled={updatePaymentPlanSettings.isPending}
            >
              {updatePaymentPlanSettings.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Receivables Dialog Component
const ReceivablesDialog = ({ installmentId, installmentNumber, dueDate, open, onOpenChange }) => {
  // Fetch receivables for this installment
  const { data: receivables, isLoading, error } = useQuery({
    queryKey: ['installmentReceivables', installmentId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-payment-plans', {
        body: { action: 'getInstallmentReceivables', installmentId },
      });
      
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!installmentId && open,
  });

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recebíveis da Parcela {installmentNumber}</DialogTitle>
          </DialogHeader>
          <div className="py-4">Carregando...</div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recebíveis da Parcela {installmentNumber}</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-red-500">Erro: {error.message}</div>
        </DialogContent>
      </Dialog>
    );
  }

  // Format the installment due date
  const formattedDueDate = dueDate ? format(new Date(dueDate), 'dd MMMM yyyy', { locale: ptBR }) : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Recebíveis da Parcela {installmentNumber} - Vencimento: {formattedDueDate}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* PMT Receivables */}
          <div>
            <h3 className="text-lg font-medium mb-2">Recebíveis PMT</h3>
            {receivables?.pmtReceivables && receivables.pmtReceivables.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Comprador</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receivables.pmtReceivables.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.receivables.buyer_name}</TableCell>
                      <TableCell>{item.receivables.buyer_cpf}</TableCell>
                      <TableCell>{format(new Date(item.receivables.due_date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.receivables.amount)}</TableCell>
                      <TableCell>
                        <Badge>{item.receivables.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-gray-500">Nenhum recebível PMT encontrado.</p>
            )}
          </div>

          {/* Billing Receivables */}
          <div>
            <h3 className="text-lg font-medium mb-2">Recebíveis de Faturamento</h3>
            {receivables?.billingReceivables && receivables.billingReceivables.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Comprador</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Vencimento Original</TableHead>
                    <TableHead>Nova Data Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receivables.billingReceivables.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.receivables.buyer_name}</TableCell>
                      <TableCell>{item.receivables.buyer_cpf}</TableCell>
                      <TableCell>{format(new Date(item.receivables.due_date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                        {item.nova_data_vencimento 
                          ? format(new Date(item.nova_data_vencimento), 'dd/MM/yyyy')
                          : format(new Date(item.receivables.due_date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(item.receivables.amount)}</TableCell>
                      <TableCell>
                        <Badge>{item.receivables.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-gray-500">Nenhum recebível de faturamento encontrado.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPaymentPlanDetailPage;
