
import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Define the CreditAnalysis interface
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

interface CreditAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyName: string;
  onSave: (data: Partial<CreditAnalysis>) => void;
  initialData: CreditAnalysis | null;
}

export function CreditAnalysisDialog({
  open,
  onOpenChange,
  companyName,
  onSave,
  initialData,
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

  // Reset form when initialData changes
  useEffect(() => {
    if (open) {
      console.log('Dialog opened with initialData:', initialData);
      form.reset({
        interest_rate_180: initialData?.interest_rate_180 || 0,
        interest_rate_360: initialData?.interest_rate_360 || 0,
        interest_rate_720: initialData?.interest_rate_720 || 0,
        interest_rate_long_term: initialData?.interest_rate_long_term || 0,
        fee_per_receivable: initialData?.fee_per_receivable || 0,
        credit_limit: initialData?.credit_limit || 0,
        consumed_credit: initialData?.consumed_credit || 0,
        status: initialData?.status || 'Ativa'
      });
    }
  }, [initialData, open, form]);

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setSubmitting(true);
      await onSave(values);
      // Don't reset the form here, as it will be closed by the parent component
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setSubmitting(false);
    }
  };

  // Format currency input
  const formatCurrency = (value: number | string) => {
    if (value === undefined || value === null || value === "") return "R$ 0,00";
    
    // Convert to number
    const numericValue = typeof value === 'string' 
      ? parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.')) 
      : value;
    
    // Format as currency
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(numericValue);
  };

  // Parse currency input
  const parseCurrency = (value: string) => {
    // Remove all non-numeric characters except for the last dot or comma
    return value.replace(/[^\d]/g, '');
  };

  // Format percentage input
  const formatPercentage = (value: number | string) => {
    if (value === undefined || value === null || value === "") return "0%";
    
    return `${value}%`;
  };

  // Parse percentage input
  const parsePercentage = (value: string) => {
    // Remove all non-numeric characters except dots
    return value.replace(/[^\d.]/g, '');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Editar Análise de Crédito" : "Nova Análise de Crédito"}
          </DialogTitle>
          <DialogDescription>
            {companyName}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="credit_limit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Limite de Crédito</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="R$ 0,00"
                        onChange={(e) => {
                          const rawValue = parseCurrency(e.target.value);
                          field.onChange(rawValue ? parseInt(rawValue, 10) / 100 : 0);
                        }}
                        value={formatCurrency(field.value)}
                      />
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
                    <FormLabel>Crédito Consumido</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="R$ 0,00"
                        onChange={(e) => {
                          const rawValue = parseCurrency(e.target.value);
                          field.onChange(rawValue ? parseInt(rawValue, 10) / 100 : 0);
                        }}
                        value={formatCurrency(field.value)}
                      />
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
                    <FormLabel>Taxa de Juros até 180 dias</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="0%"
                        onChange={(e) => {
                          const rawValue = parsePercentage(e.target.value);
                          field.onChange(rawValue ? parseFloat(rawValue) : 0);
                        }}
                        value={formatPercentage(field.value)}
                      />
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
                    <FormLabel>Taxa de Juros até 360 dias</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="0%"
                        onChange={(e) => {
                          const rawValue = parsePercentage(e.target.value);
                          field.onChange(rawValue ? parseFloat(rawValue) : 0);
                        }}
                        value={formatPercentage(field.value)}
                      />
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
                    <FormLabel>Taxa de Juros até 720 dias</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="0%"
                        onChange={(e) => {
                          const rawValue = parsePercentage(e.target.value);
                          field.onChange(rawValue ? parseFloat(rawValue) : 0);
                        }}
                        value={formatPercentage(field.value)}
                      />
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
                    <FormLabel>Taxa de Juros Longo Prazo</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="0%"
                        onChange={(e) => {
                          const rawValue = parsePercentage(e.target.value);
                          field.onChange(rawValue ? parseFloat(rawValue) : 0);
                        }}
                        value={formatPercentage(field.value)}
                      />
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
                    <FormLabel>Tarifa por Recebível</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="R$ 0,00"
                        onChange={(e) => {
                          const rawValue = parseCurrency(e.target.value);
                          field.onChange(rawValue ? parseInt(rawValue, 10) / 100 : 0);
                        }}
                        value={formatCurrency(field.value)}
                      />
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
                      value={field.value}
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
