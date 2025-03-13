
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { DownloadCloud, FileText, Search } from "lucide-react";
import { BuyerStatusDialog } from "./BuyerStatusDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface BuyerActionButtonsProps {
  buyer: {
    id: string;
    full_name: string;
    contract_status: string;
    credit_analysis_status: string;
    contract_file_path?: string;
    contract_file_name?: string;
  };
  onStatusUpdated: () => void;
}

export function BuyerActionButtons({ buyer, onStatusUpdated }: BuyerActionButtonsProps) {
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    if (!buyer.contract_file_path) {
      toast({
        title: "Nenhum contrato disponível",
        description: "Este comprador ainda não possui um contrato para download.",
        variant: "default",
      });
      return;
    }
    
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(buyer.contract_file_path);
      
      if (error) {
        console.error('Error downloading contract:', error);
        throw error;
      }
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = buyer.contract_file_name || 'contrato.pdf';
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download iniciado",
        description: "O contrato está sendo baixado."
      });
    } catch (error) {
      console.error('Error downloading contract:', error);
      toast({
        title: "Erro ao baixar contrato",
        description: "Não foi possível baixar o contrato.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => setContractDialogOpen(true)}
        title="Alterar status do contrato"
      >
        <FileText className="h-4 w-4" />
      </Button>
      
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => setCreditDialogOpen(true)}
        title="Alterar status da análise de crédito"
      >
        <Search className="h-4 w-4" />
      </Button>
      
      <Button 
        variant="ghost" 
        size="sm"
        onClick={handleDownload}
        disabled={!buyer.contract_file_path}
        title="Baixar contrato"
      >
        <DownloadCloud className="h-4 w-4" />
      </Button>
      
      <BuyerStatusDialog
        open={contractDialogOpen}
        onOpenChange={setContractDialogOpen}
        buyerId={buyer.id}
        buyerName={buyer.full_name}
        statusType="contract"
        currentStatus={buyer.contract_status}
        onStatusUpdated={onStatusUpdated}
      />
      
      <BuyerStatusDialog
        open={creditDialogOpen}
        onOpenChange={setCreditDialogOpen}
        buyerId={buyer.id}
        buyerName={buyer.full_name}
        statusType="credit"
        currentStatus={buyer.credit_analysis_status}
        onStatusUpdated={onStatusUpdated}
      />
    </div>
  );
}
