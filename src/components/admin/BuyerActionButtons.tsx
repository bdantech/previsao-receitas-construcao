
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { DownloadCloud, FileText, Search } from "lucide-react";
import { BuyerStatusDialog } from "./BuyerStatusDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { downloadDocument } from "@/integrations/supabase/documentService";

interface BuyerActionButtonsProps {
  buyer: {
    id: string;
    full_name: string;
    contract_status: string;
    credit_analysis_status: string;
    contract_file_path?: string;
    contract_file_name?: string;
    company_id?: string;
    project_id?: string;
  };
  onStatusUpdated: () => void;
}

export function BuyerActionButtons({ buyer, onStatusUpdated }: BuyerActionButtonsProps) {
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  // Check if a contract is available to download
  const hasContract = !!buyer.contract_file_path && buyer.contract_file_path.trim() !== '';

  const handleDownload = async () => {
    if (!hasContract) {
      toast({
        title: "Nenhum contrato disponível",
        description: "Este comprador ainda não possui um contrato para download.",
        variant: "default",
      });
      return;
    }
    
    try {
      setIsDownloading(true);
      
      // Log the file path being requested to help with debugging
      console.log('Attempting to download file from path:', buyer.contract_file_path);
      
      // Verify if the file exists before attempting to download
      try {
        const { data: fileExistsData, error: fileExistsError } = await supabase.storage
          .from('documents')
          .list(`projects/${buyer.project_id}`);
        
        const fileName = buyer.contract_file_path?.split('/').pop();
        const fileExists = fileExistsData?.some(file => file.name === fileName);
        
        if (fileExistsError || !fileExists) {
          console.error('File does not exist check result:', { fileExistsData, fileExistsError, fileName });
          toast({
            title: "Arquivo não encontrado",
            description: "O arquivo do contrato não foi encontrado no armazenamento.",
            variant: "destructive"
          });
          return;
        }
      } catch (existsError) {
        console.error('Error checking if file exists:', existsError);
        // Continue anyway, as the list API might be restricted
      }
      
      // Call the enhanced downloadDocument utility
      await downloadDocument(buyer.contract_file_path, buyer.contract_file_name);
      
      toast({
        title: "Download iniciado",
        description: "O contrato está sendo baixado."
      });
    } catch (error) {
      console.error('Error downloading contract:', error);
      toast({
        title: "Erro ao baixar contrato",
        description: error instanceof Error ? error.message : "Não foi possível baixar o contrato.",
        variant: "destructive"
      });
    } finally {
      setIsDownloading(false);
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
        disabled={!hasContract || isDownloading}
        title={hasContract ? "Baixar contrato" : "Sem contrato disponível"}
      >
        <DownloadCloud className={`h-4 w-4 ${isDownloading ? 'animate-spin' : ''}`} />
      </Button>
      
      <BuyerStatusDialog
        open={contractDialogOpen}
        onOpenChange={setContractDialogOpen}
        buyerId={buyer.id}
        buyerName={buyer.full_name}
        statusType="contract"
        currentStatus={buyer.contract_status}
        onStatusUpdated={onStatusUpdated}
        companyId={buyer.company_id}
        projectId={buyer.project_id}
      />
      
      <BuyerStatusDialog
        open={creditDialogOpen}
        onOpenChange={setCreditDialogOpen}
        buyerId={buyer.id}
        buyerName={buyer.full_name}
        statusType="credit"
        currentStatus={buyer.credit_analysis_status}
        onStatusUpdated={onStatusUpdated}
        companyId={buyer.company_id}
        projectId={buyer.project_id}
      />
    </div>
  );
}
