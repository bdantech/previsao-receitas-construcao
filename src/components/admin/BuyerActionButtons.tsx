
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
      
      // Check if the file exists first
      const { data: fileData, error: fileError } = await supabase.storage
        .from('documents')
        .list(buyer.contract_file_path.split('/').slice(0, -1).join('/'));
      
      if (fileError) {
        console.error('Error checking file existence:', fileError);
        throw new Error(`Error checking if file exists: ${fileError.message}`);
      }
      
      const fileName = buyer.contract_file_path.split('/').pop();
      const fileExists = fileData?.some(file => file.name === fileName);
      
      if (!fileExists) {
        console.error('File does not exist in storage:', buyer.contract_file_path);
        throw new Error('O arquivo do contrato não foi encontrado no armazenamento.');
      }
      
      // Try to download with public URL first, as it's more reliable
      const { data: publicUrlData } = await supabase.storage
        .from('documents')
        .getPublicUrl(buyer.contract_file_path);
      
      if (publicUrlData?.publicUrl) {
        // Open the public URL in a new tab
        window.open(publicUrlData.publicUrl, '_blank');
        
        toast({
          title: "Download iniciado",
          description: "O contrato está sendo baixado."
        });
        return;
      }
      
      // Fallback to signed URL if public URL is not available
      console.log('Public URL not available, attempting to create signed URL');
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('documents')
        .createSignedUrl(buyer.contract_file_path, 60); // 60 seconds expiry
      
      if (signedUrlError) {
        console.error('Error creating signed URL:', signedUrlError);
        throw new Error(`Erro ao gerar URL de download: ${signedUrlError.message}`);
      }
      
      if (!signedUrlData || !signedUrlData.signedUrl) {
        throw new Error('Falha ao gerar URL de download');
      }
      
      // Open the signed URL in a new tab
      window.open(signedUrlData.signedUrl, '_blank');
      
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
