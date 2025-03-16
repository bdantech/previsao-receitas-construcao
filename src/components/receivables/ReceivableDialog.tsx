
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { maskCPF, isValidCPF } from "@/lib/formatters";
import { useAuth } from "@/hooks/useAuth";

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
  const [buyerName, setBuyerName] = useState("");
  const [buyerCpf, setBuyerCpf] = useState("");
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();
  const { session } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setCpfError(null);

    // Check authentication
    if (!session) {
      setErrorMessage("Você precisa estar autenticado para criar recebíveis.");
      toast({
        title: "Autenticação necessária",
        description: "Você precisa estar autenticado para criar recebíveis.",
        variant: "destructive",
      });
      return;
    }

    // Basic validation
    if (!buyerName || !buyerCpf || !amount || !dueDate) {
      setErrorMessage("Preencha todos os campos obrigatórios.");
      toast({
        title: "Dados incompletos",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    // Format CPF to numbers only
    const cleanCpf = buyerCpf.replace(/\D/g, "");
    
    // Validate CPF
    if (!isValidCPF(cleanCpf)) {
      setCpfError("CPF inválido. Verifique se o número está correto.");
      toast({
        title: "CPF inválido",
        description: "O CPF informado não é válido. Verifique se o número está correto.",
        variant: "destructive",
      });
      return;
    }
    
    // Parse amount to number
    const amountValue = parseFloat(amount.replace(/\./g, "").replace(",", "."));

    if (isNaN(amountValue)) {
      setErrorMessage("O valor informado não é válido.");
      toast({
        title: "Valor inválido",
        description: "O valor informado não é válido.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await supabase.functions.invoke('project-receivables', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          method: 'POST',
          endpoint: 'receivables',
          projectId,
          buyerName,
          buyerCpf: cleanCpf,
          amount: amountValue,
          dueDate,
          description: description.trim() || undefined,
        }
      });

      toast({
        title: "Recebível criado",
        description: "O recebível foi criado com sucesso.",
      });

      // Reset form
      setBuyerName("");
      setBuyerCpf("");
      setAmount("");
      setDueDate("");
      setDescription("");
      setErrorMessage(null);
      setCpfError(null);

      // Close dialog and refresh data
      onOpenChange(false);
      onReceivableCreated();
    } catch (error) {
      console.error("Error creating receivable:", error);
      
      // More descriptive error message
      let errorMsg = "Não foi possível criar o recebível. ";
      
      if (error instanceof Error) {
        // Check for specific authentication errors
        if (error.message.includes("Auth session") || error.message.includes("Authentication required")) {
          errorMsg = "Erro de autenticação. Por favor, faça login novamente e tente de novo.";
        } else {
          errorMsg += error.message;
        }
      } else {
        errorMsg += "Verifique os dados e tente novamente.";
      }
      
      setErrorMessage(errorMsg);
      
      toast({
        title: "Erro ao criar recebível",
        description: errorMsg,
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
    // Clear CPF error when user starts typing again
    if (cpfError) setCpfError(null);
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
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-sm">
              {errorMessage}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="buyerName">Nome do Comprador *</Label>
            <Input
              id="buyerName"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="Nome completo"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="buyerCpf">CPF do Comprador *</Label>
            <Input
              id="buyerCpf"
              value={buyerCpf}
              onChange={handleCpfChange}
              placeholder="000.000.000-00"
              maxLength={14}
              required
              className={cpfError ? "border-red-300" : ""}
            />
            {cpfError && (
              <div className="text-sm text-red-500 mt-1">{cpfError}</div>
            )}
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
