
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { projectBuyersApi } from "@/integrations/supabase/client";

type StatusType = 'contract' | 'credit';

interface BuyerStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buyerId: string;
  buyerName: string;
  statusType: StatusType;
  currentStatus: string;
  onStatusUpdated: () => void;
}

export function BuyerStatusDialog({
  open,
  onOpenChange,
  buyerId,
  buyerName,
  statusType,
  currentStatus,
  onStatusUpdated
}: BuyerStatusDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  const statusTitle = statusType === 'contract' ? 'Contrato' : 'Análise de Crédito';
  
  const statusOptions = [
    { value: 'aprovado', label: 'Aprovado' },
    { value: 'reprovado', label: 'Reprovado' },
    { value: 'a_analisar', label: 'Em Análise' },
    ...(statusType === 'contract' ? [{ value: 'a_enviar', label: 'A Enviar' }] : [])
  ];

  const handleSubmit = async () => {
    if (!buyerId || selectedStatus === currentStatus) return;
    
    try {
      setIsSubmitting(true);
      
      const updateData = statusType === 'contract' 
        ? { contract_status: selectedStatus } 
        : { credit_analysis_status: selectedStatus };
      
      await projectBuyersApi.admin.updateBuyer(buyerId, updateData);
      
      toast({
        title: "Status atualizado",
        description: `O status de ${statusTitle.toLowerCase()} foi atualizado com sucesso.`,
      });
      
      onStatusUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error(`Error updating ${statusType} status:`, error);
      toast({
        title: "Erro ao atualizar status",
        description: `Não foi possível atualizar o status de ${statusTitle.toLowerCase()}.`,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Alterar Status de {statusTitle}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <div className="mb-4">
            <p className="text-sm text-gray-500">Comprador: <span className="font-medium text-gray-700">{buyerName}</span></p>
          </div>
          <div className="space-y-4">
            <Label>Status de {statusTitle}</Label>
            <RadioGroup value={selectedStatus} onValueChange={setSelectedStatus}>
              {statusOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={`${statusType}-${option.value}`} />
                  <Label htmlFor={`${statusType}-${option.value}`}>{option.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || selectedStatus === currentStatus}>
            {isSubmitting ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
