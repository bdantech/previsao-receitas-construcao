import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";
import { format } from "date-fns";
import { Boleto } from "./BoletosTable";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCPF } from "@/lib/formatters";

type ViewBoletoDialogProps = {
  boleto: Boleto | null;
  open: boolean;
  onClose: () => void;
};

export const ViewBoletoDialog: React.FC<ViewBoletoDialogProps> = ({
  boleto,
  open,
  onClose,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [companyName, setCompanyName] = useState<string>("");
  const { toast } = useToast();
  const { getAuthHeader, session } = useAuth();

  useEffect(() => {
    const fetchCompanyName = async () => {
      if (!session?.access_token) return;
      
      try {
        const { data, error } = await supabase.functions.invoke('user-company-data', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });
        
        if (error) {
          console.error("Error fetching company data:", error);
          return;
        }
        
        if (data.companies && data.companies.length > 0) {
          setCompanyName(data.companies[0].name);
        }
      } catch (error) {
        console.error("Error:", error);
      }
    };

    fetchCompanyName();
  }, [session]);

  // Function to download the existing boleto file
  const handleDownloadFile = async () => {
    if (!boleto || !boleto.arquivo_boleto_path) return;
    
    setDownloading(true);
    try {
      // Use storage-management function to get a signed URL
      const { data, error } = await supabase.functions.invoke("storage-management", {
        body: {
          action: "downloadFile",
          data: {
            bucketName: 'documents',
            filePath: boleto.arquivo_boleto_path,
          },
        },
        headers: await getAuthHeader()
      });
      
      if (error) {
        console.error("Error getting download URL:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: `Erro ao preparar o download: ${error.message}`,
        });
        return;
      }
      
      if (!data || !data.url) {
        throw new Error("Failed to get download URL");
      }
      
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = data.url;
      link.download = boleto.arquivo_boleto_name || 'boleto.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error("Error in download function:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao baixar o arquivo do boleto.",
      });
    } finally {
      setDownloading(false);
    }
  };

  if (!boleto) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detalhes do Boleto</DialogTitle>
          <DialogDescription>
            Informações detalhadas do boleto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium mb-1">Empresa</p>
              <p className="text-sm">{companyName || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Projeto</p>
              <p className="text-sm">{boleto.projects?.name || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Pagador</p>
              <p className="text-sm">
                {boleto.billing_receivables?.receivables?.buyer_name || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">CPF/CNPJ</p>
              <p className="text-sm">{formatCPF(boleto.payer_tax_id)}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Valor do Boleto</p>
              <p className="text-sm">
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(boleto.valor_boleto)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Data de Vencimento</p>
              <p className="text-sm">
                {format(new Date(boleto.data_vencimento), "dd/MM/yyyy")}
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <div>
              <p className="text-sm font-medium mb-1">Status de Emissão</p>
              <p className="text-sm">{boleto.status_emissao}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Status de Pagamento</p>
              <p className="text-sm">{boleto.status_pagamento}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Nosso Número</p>
              <p className="text-sm">{boleto.nosso_numero || "—"}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Linha Digitável</p>
              <p className="text-sm">{boleto.linha_digitavel || "—"}</p>
            </div>

            {boleto.arquivo_boleto_name && (
              <div className="space-y-2">
                <p className="text-sm font-medium mb-1">Arquivo do Boleto</p>
                <div className="flex items-center justify-between text-sm text-muted-foreground p-2 bg-muted rounded-md">
                  <span>{boleto.arquivo_boleto_name}</span>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={handleDownloadFile}
                    disabled={downloading}
                  >
                    {downloading ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-1" />
                    )}
                    {downloading ? "Baixando..." : "Baixar"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button onClick={onClose} disabled={downloading}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
