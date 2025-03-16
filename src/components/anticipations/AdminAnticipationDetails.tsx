import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader, X, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency, formatCNPJ, formatCPF } from "@/lib/formatters";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

interface Company {
  name: string;
  cnpj: string;
}

interface Project {
  name: string;
  cnpj: string;
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
  taxa_juros_180: number;
  taxa_juros_360: number;
  taxa_juros_720: number;
  taxa_juros_longo_prazo: number;
  tarifa_por_recebivel: number;
  companies: Company;
  projects: Project;
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

interface AdminAnticipationDetailsProps {
  anticipationId: string;
  onClose: () => void;
  onStatusUpdate: () => void;
}

export const AdminAnticipationDetails = ({ 
  anticipationId, 
  onClose, 
  onStatusUpdate 
}: AdminAnticipationDetailsProps) => {
  const { session } = useAuth();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [anticipation, setAnticipation] = useState<Anticipation | null>(null);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  
  const [newStatus, setNewStatus] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isReceivablesOpen, setIsReceivablesOpen] = useState(false);
  
  useEffect(() => {
    const fetchDetails = async () => {
      if (!session?.access_token || !anticipationId) return;
      
      try {
        setIsLoading(true);
        
        const { data, error } = await supabase.functions.invoke('admin-anticipations', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: {
            action: 'getAnticipationDetails',
            anticipationId
          }
        });
        
        if (error) throw error;
        
        if (data) {
          setAnticipation(data.anticipation);
          setReceivables(data.receivables || []);
          setNewStatus(data.anticipation.status);
        }
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
    
    fetchDetails();
  }, [session, anticipationId, toast]);
  
  const handleUpdateStatus = async () => {
    if (!session?.access_token || !anticipation || newStatus === anticipation.status) return;
    
    try {
      setIsSaving(true);
      
      const { data, error } = await supabase.functions.invoke('admin-anticipations', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          action: 'updateAnticipationStatus',
          anticipationId,
          newStatus,
          notes
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Status atualizado",
        description: `A antecipação foi ${newStatus.toLowerCase()} com sucesso.`,
        variant: "default"
      });
      
      onStatusUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating anticipation status:', error);
      toast({
        title: "Erro ao atualizar status",
        description: "Não foi possível atualizar o status da antecipação.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
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
  
  const getAvailableStatusOptions = (currentStatus: string) => {
    switch (currentStatus) {
      case 'Solicitada':
        return ['Solicitada', 'Aprovada', 'Reprovada'];
      case 'Aprovada':
        return ['Aprovada', 'Concluída', 'Reprovada'];
      case 'Reprovada':
        return ['Reprovada'];
      case 'Concluída':
        return ['Concluída'];
      default:
        return [currentStatus];
    }
  };
  
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Detalhes da Antecipação</span>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        ) : anticipation ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-1 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-gray-500">Empresa</h3>
                  <p className="font-medium">{anticipation.companies.name}</p>
                  <p className="text-sm text-gray-500">CNPJ: {formatCNPJ(anticipation.companies.cnpj)}</p>
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-gray-500">Data de Solicitação</h3>
                  <p className="font-medium">{format(new Date(anticipation.created_at), 'dd/MM/yyyy', { locale: ptBR })}</p>
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-gray-500">Valor Total</h3>
                  <p className="text-lg font-semibold">{formatCurrency(anticipation.valor_total)}</p>
                </div>
              </div>
              
              <div className="col-span-1 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-gray-500">Projeto</h3>
                  <p className="font-medium">{anticipation.projects.name}</p>
                  <p className="text-sm text-gray-500">CNPJ: {formatCNPJ(anticipation.projects.cnpj)}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium text-gray-500">Status</h3>
                    <div>{getStatusBadge(anticipation.status)}</div>
                  </div>
                  
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium text-gray-500">Recebíveis</h3>
                    <p className="font-medium">{anticipation.quantidade_recebiveis}</p>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-gray-500">Valor Líquido</h3>
                  <p className="text-lg font-semibold">{formatCurrency(anticipation.valor_liquido)}</p>
                </div>
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h3 className="text-base font-medium mb-3">Taxas e Tarifas</h3>
              
              <div className="grid grid-cols-5 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Taxa até 180 dias</h4>
                  <p className="mt-1">{anticipation.taxa_juros_180}%</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Taxa até 360 dias</h4>
                  <p className="mt-1">{anticipation.taxa_juros_360}%</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Taxa até 720 dias</h4>
                  <p className="mt-1">{anticipation.taxa_juros_720}%</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Taxa longo prazo</h4>
                  <p className="mt-1">{anticipation.taxa_juros_longo_prazo}%</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Tarifa por recebível</h4>
                  <p className="mt-1">{formatCurrency(anticipation.tarifa_por_recebivel)}</p>
                </div>
              </div>
            </div>
            
            <Separator />
            
            <Collapsible
              open={isReceivablesOpen}
              onOpenChange={setIsReceivablesOpen}
              className="w-full"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-medium">Recebíveis Antecipados</h3>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex items-center gap-1 p-0 h-8">
                    {isReceivablesOpen ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        <span>Recolher</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        <span>Expandir</span>
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
              </div>
              
              <CollapsibleContent className="mt-3">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium text-sm">Comprador</th>
                        <th className="text-left py-2 px-3 font-medium text-sm">CPF</th>
                        <th className="text-right py-2 px-3 font-medium text-sm">Valor</th>
                        <th className="text-left py-2 px-3 font-medium text-sm">Vencimento</th>
                        <th className="text-left py-2 px-3 font-medium text-sm">Descrição</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receivables.length > 0 ? (
                        receivables.map((receivable) => (
                          <tr key={receivable.id} className="border-b hover:bg-gray-50">
                            <td className="py-2 px-3">{receivable.buyer_name}</td>
                            <td className="py-2 px-3">{formatCPF(receivable.buyer_cpf)}</td>
                            <td className="py-2 px-3 text-right">{formatCurrency(receivable.amount)}</td>
                            <td className="py-2 px-3">
                              {format(new Date(receivable.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                            </td>
                            <td className="py-2 px-3">{receivable.description}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-gray-500">
                            Nenhum recebível encontrado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CollapsibleContent>
            </Collapsible>
            
            <Separator />
            
            <div>
              <h3 className="text-base font-medium mb-3">Atualizar Status</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Novo Status</label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableStatusOptions(anticipation.status).map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Observações</label>
                  <Textarea 
                    placeholder="Adicione observações sobre esta mudança de status"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center text-gray-500">
            Não foi possível carregar os detalhes da antecipação.
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            disabled={isSaving || !anticipation || newStatus === anticipation?.status}
            onClick={handleUpdateStatus}
          >
            {isSaving ? (
              <>
                <Loader className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Atualizar Status'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
