
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { receivablesApi } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { maskCPF } from "@/lib/formatters";
import { useAuth } from "@/hooks/useAuth";

export function NewReceivablePage() {
  const [buyerCpf, setBuyerCpf] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();
  const { session } = useAuth();
  const navigate = useNavigate();
  const { projectId } = useParams();

  if (!projectId) {
    return <div>Project ID is required</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

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
    if (!buyerCpf || !amount || !dueDate) {
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

      // Navigate back to project dashboard
      navigate(`/project/${projectId}`);
    } catch (error: any) {
      console.error("Error creating receivable:", error);
      
      let errorMsg = "Não foi possível criar o recebível. ";
      
      if (error.message.includes("Auth session") || error.message.includes("Authentication required")) {
        errorMsg = "Erro de autenticação. Por favor, faça login novamente e tente de novo.";
      } else {
        errorMsg += error.message;
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
    <div className="container mx-auto py-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Adicionar Recebível</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-sm">
                {errorMessage}
              </div>
            )}
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
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/project/${projectId}`)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Adicionar Recebível"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
