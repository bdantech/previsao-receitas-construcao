
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type BillingReceivable = {
  id: string;
  nova_data_vencimento: string;
  amount: number;
  buyer_name: string;
  buyer_cpf: string;
  project_id: string;
  project_name: string;
  project_cnpj: string;
  company_id: string;
  company_name: string;
  numero_parcela: number;
  index_id: string | null;
  index_name: string | null;
  adjustment_base_date: string | null;
};

type CreateBoletosDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export const CreateBoletosDialog: React.FC<CreateBoletosDialogProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [billingReceivables, setBillingReceivables] = useState<BillingReceivable[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { toast } = useToast();
  const { getAuthHeader } = useAuth();

  // Fetch available billing receivables when dialog opens
  React.useEffect(() => {
    if (open) {
      fetchAvailableBillingReceivables();
    } else {
      setSelectedIds([]);
    }
  }, [open]);

  const fetchAvailableBillingReceivables = async () => {
    setIsFetching(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-boletos", {
        body: {
          action: "getAvailableBillingReceivables",
        },
        headers: getAuthHeader(),
      });

      if (error) {
        console.error("Error fetching billing receivables:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível carregar os recebíveis disponíveis.",
        });
        return;
      }

      setBillingReceivables(data.billingReceivables || []);
    } catch (error) {
      console.error("Error:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao carregar os recebíveis disponíveis.",
      });
    } finally {
      setIsFetching(false);
    }
  };

  const handleSelectAllChange = (checked: boolean) => {
    if (checked) {
      setSelectedIds(billingReceivables.map((br) => br.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleCheckboxChange = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleCreateBoletos = async () => {
    if (selectedIds.length === 0) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Selecione pelo menos um recebível para gerar boleto.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-boletos", {
        body: {
          action: "createBoletos",
          data: {
            billingReceivableIds: selectedIds,
          },
        },
        headers: getAuthHeader(),
      });

      if (error) {
        console.error("Error creating boletos:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível criar os boletos.",
        });
        return;
      }

      const { totalCreated, totalErrors } = data;
      
      toast({
        title: "Boletos gerados com sucesso",
        description: `${totalCreated} boletos foram criados. ${totalErrors > 0 ? `${totalErrors} falhas.` : ''}`,
      });
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao criar boletos.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Gerar Boletos</DialogTitle>
          <DialogDescription>
            Selecione os recebíveis para os quais deseja gerar boletos.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={
                      billingReceivables.length > 0 &&
                      selectedIds.length === billingReceivables.length
                    }
                    onCheckedChange={handleSelectAllChange}
                    disabled={isFetching || billingReceivables.length === 0}
                  />
                </TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Comprador</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead>Índice</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isFetching ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6">
                    <div className="flex justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : billingReceivables.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6">
                    Não há recebíveis disponíveis para gerar boletos.
                  </TableCell>
                </TableRow>
              ) : (
                billingReceivables.map((br) => (
                  <TableRow key={br.id}>
                    <TableCell className="py-2">
                      <Checkbox
                        checked={selectedIds.includes(br.id)}
                        onCheckedChange={(checked) =>
                          handleCheckboxChange(br.id, checked === true)
                        }
                      />
                    </TableCell>
                    <TableCell className="py-2">{br.company_name}</TableCell>
                    <TableCell className="py-2">{br.project_name}</TableCell>
                    <TableCell className="py-2">
                      {br.buyer_name}
                      <div className="text-xs text-gray-500">{br.buyer_cpf}</div>
                    </TableCell>
                    <TableCell className="py-2">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(br.amount)}
                    </TableCell>
                    <TableCell className="py-2">
                      {format(
                        new Date(br.nova_data_vencimento),
                        "dd/MM/yyyy",
                        { locale: ptBR }
                      )}
                    </TableCell>
                    <TableCell className="py-2">{br.numero_parcela}</TableCell>
                    <TableCell className="py-2">{br.index_name || "Não definido"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreateBoletos}
            disabled={isLoading || selectedIds.length === 0}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando Boletos...
              </>
            ) : (
              `Gerar ${selectedIds.length} Boleto(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
