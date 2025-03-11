
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { receivablesApi } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { maskCPF } from "@/lib/formatters";

interface ReceivableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onReceivableCreated: () => void;
}

export function ReceivableDialog({
  open,
  onOpenChange,
  projectId,
  onReceivableCreated
}: ReceivableDialogProps) {
  const [buyerCpf, setBuyerCpf] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!buyerCpf || !amount || !dueDate) {
      toast({
        title: "Dados incompletos",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    // Format CPF to numbers only
    const cleanCpf = buyerCpf.replace(/\D/g, "");
    
    // Parse amount to number
    const amountValue = parseFloat(amount.replace(/\./g, "").replace(",", "."));

    if (isNaN(amountValue)) {
      toast({
        title: "Valor inválido",
        description: "O valor informado não é válido.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      await receivablesApi.createReceivable({
        projectId,
        buyerCpf: cleanCpf,
        amount: amountValue,
        dueDate,
        description: description.trim() || undefined,
      });

      toast({
        title: "Recebível criado",
        description: "O recebível foi criado com sucesso.",
      });

      // Reset form
      setBuyerCpf("");
      setAmount("");
      setDueDate("");
      setDescription("");

      // Close dialog and refresh data
      onOpenChange(false);
      onReceivableCreated();
    } catch (error) {
      console.error("Error creating receivable:", error);
      toast({
        title: "Erro ao criar recebível",
        description: "Não foi possível criar o recebível. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle CPF input with mask
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBuyerCpf(maskCPF(value));
  };

  // Handle amount input with formatting (Brazilian currency)
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    if (value === "") {
      setAmount("");
      return;
    }
    
    const floatValue = parseFloat(value) / 100;
    setAmount(floatValue.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adicionar Recebível</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="buyerCpf">CPF do Comprador *</Label>
            <Input
              id="buyerCpf"
              value={buyerCpf}
              onChange={handleCpfChange}
              placeholder="000.000.000-00"
              maxLength={14}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$) *</Label>
            <Input
              id="amount"
              value={amount}
              onChange={handleAmountChange}
              placeholder="0,00"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dueDate">Data de Vencimento *</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Adicione uma descrição para este recebível (opcional)"
              rows={3}
            />
          </div>
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Adicionar Recebível"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
