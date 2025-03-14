
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CreditAnalysis {
  id: string;
  company_id: string;
  interest_rate_180: number;
  interest_rate_360: number;
  interest_rate_720: number;
  interest_rate_long_term: number;
  fee_per_receivable: number;
  credit_limit: number;
  consumed_credit: number;
  available_credit: number;
  status: 'Ativa' | 'Inativa';
  created_at: string;
  updated_at: string;
}

interface CreditAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyName: string;
  onSave: (data: Partial<CreditAnalysis>) => void;
  initialData: CreditAnalysis | null;
}

const formSchema = z.object({
  interest_rate_180: z.coerce.number().min(0, "Taxa de juros deve ser positiva"),
  interest_rate_360: z.coerce.number().min(0, "Taxa de juros deve ser positiva"),
  interest_rate_720: z.coerce.number().min(0, "Taxa de juros deve ser positiva"),
  interest_rate_long_term: z.coerce.number().min(0, "Taxa de juros deve ser positiva"),
  fee_per_receivable: z.coerce.number().min(0, "Tarifa deve ser positiva"),
  credit_limit: z.coerce.number().min(0, "Limite de crédito deve ser positivo"),
  consumed_credit: z.coerce.number().min(0, "Crédito consumido deve ser positivo"),
  status: z.enum(['Ativa', 'Inativa'])
});

export function CreditAnalysisDialog({
  open,
  onOpenChange,
  companyName,
  onSave,
  initialData
}: CreditAnalysisDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      interest_rate_180: initialData?.interest_rate_180 || 0,
      interest_rate_360: initialData?.interest_rate_360 || 0,
      interest_rate_720: initialData?.interest_rate_720 || 0,
      interest_rate_long_term: initialData?.interest_rate_long_term || 0,
      fee_per_receivable: initialData?.fee_per_receivable || 0,
      credit_limit: initialData?.credit_limit || 0,
      consumed_credit: initialData?.consumed_credit || 0,
      status: initialData?.status || 'Ativa'
    }
  });

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setSubmitting(true);
      await onSave(values);
      form.reset();
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Editar Análise de Crédito" : "Nova Análise de Crédito"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {companyName}
          </p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="credit_limit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Limite de Crédito (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="consumed_credit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Crédito Consumido (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="interest_rate_180"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Taxa de Juros até 180 dias (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="interest_rate_360"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Taxa de Juros até 360 dias (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="interest_rate_720"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Taxa de Juros até 720 dias (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="interest_rate_long_term"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Taxa de Juros Longo Prazo (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fee_per_receivable"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tarifa por Recebível (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Ativa">Ativa</SelectItem>
                        <SelectItem value="Inativa">Inativa</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Salvando..." : initialData ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
