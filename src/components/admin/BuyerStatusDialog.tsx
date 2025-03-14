
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type StatusType = 'contract' | 'credit';

// Define the allowed status values to match the Supabase schema
type ContractStatus = 'aprovado' | 'reprovado' | 'a_enviar' | 'a_analisar';
type CreditStatus = 'aprovado' | 'reprovado' | 'a_analisar';

interface BuyerStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buyerId: string;
  buyerName: string;
  statusType: StatusType;
  currentStatus: string;
  onStatusUpdated: () => void;
  companyId?: string; // Add companyId (optional to maintain backward compatibility)
  projectId?: string; // Add projectId (optional to maintain backward compatibility)
}

export function BuyerStatusDialog({
  open,
  onOpenChange,
  buyerId,
  buyerName,
  statusType,
  currentStatus,
  onStatusUpdated,
  companyId,
  projectId
}: BuyerStatusDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [buyer, setBuyer] = useState<any>(null);
  const { toast } = useToast();
  
  const statusTitle = statusType === 'contract' ? 'Contrato' : 'Análise de Crédito';
  
  const statusOptions = [
    { value: 'aprovado', label: 'Aprovado' },
    { value: 'reprovado', label: 'Reprovado' },
    { value: 'a_analisar', label: 'Em Análise' },
    ...(statusType === 'contract' ? [{ value: 'a_enviar', label: 'A Enviar' }] : [])
  ];

  // Fetch buyer details to get companyId and projectId if not provided
  useEffect(() => {
    const fetchBuyerDetails = async () => {
      if (!open || (companyId && projectId)) return;
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        
        const { data, error } = await supabase.functions.invoke('admin-project-buyers', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: { 
            action: 'get',
            buyerId
          }
        });
        
        if (error) {
          console.error('Error fetching buyer details:', error);
          return;
        }
        
        if (data?.buyer) {
          setBuyer(data.buyer);
        }
      } catch (error) {
        console.error('Failed to fetch buyer details:', error);
      }
    };
    
    fetchBuyerDetails();
  }, [open, buyerId, companyId, projectId]);

  const handleSubmit = async () => {
    if (!buyerId || selectedStatus === currentStatus) return;
    
    try {
      setIsSubmitting(true);
      
      // Get companyId and projectId from props or fetched buyer data
      const effectiveCompanyId = companyId || buyer?.company_id;
      const effectiveProjectId = projectId || buyer?.project_id;
      
      // Check if we have the required IDs
      if (!effectiveCompanyId || !effectiveProjectId) {
        toast({
          title: "Erro ao atualizar status",
          description: "Não foi possível identificar a empresa ou projeto.",
          variant: "destructive"
        });
        return;
      }
      
      // Create the properly typed update data object with required companyId and projectId
      if (statusType === 'contract') {
        // Ensure the contract status is properly typed
        const contractStatus = selectedStatus as ContractStatus;
        await supabase.functions.invoke('admin-project-buyers', {
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: {
            action: 'update',
            buyerId,
            buyerData: { 
              contract_status: contractStatus
            },
            companyId: effectiveCompanyId,
            projectId: effectiveProjectId
          }
        });
      } else {
        // Ensure the credit status is properly typed
        const creditStatus = selectedStatus as CreditStatus;
        await supabase.functions.invoke('admin-project-buyers', {
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: {
            action: 'update',
            buyerId,
            buyerData: { 
              credit_analysis_status: creditStatus 
            },
            companyId: effectiveCompanyId,
            projectId: effectiveProjectId
          }
        });
      }
      
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
