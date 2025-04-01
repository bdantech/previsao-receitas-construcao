
import React, { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Boleto } from "./BoletosTable";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const formSchema = z.object({
  status_emissao: z.enum(["Criado", "Emitido", "Cancelado"]),
  status_pagamento: z.enum(["N/A", "Pago", "Em Aberto", "Em Atraso"]),
  nosso_numero: z.string().optional(),
  linha_digitavel: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type EditBoletoDialogProps = {
  boleto: Boleto | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export const EditBoletoDialog: React.FC<EditBoletoDialogProps> = ({
  boleto,
  open,
  onClose,
  onSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status_emissao: "Criado",
      status_pagamento: "N/A",
      nosso_numero: "",
      linha_digitavel: "",
    },
  });

  // Update form when boleto changes
  useEffect(() => {
    if (boleto) {
      form.reset({
        status_emissao: boleto.status_emissao,
        status_pagamento: boleto.status_pagamento,
        nosso_numero: boleto.nosso_numero || "",
        linha_digitavel: boleto.linha_digitavel || "",
      });
    }
  }, [boleto, form]);

  const onSubmit = async (values: FormValues) => {
    if (!boleto) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-boletos", {
        body: {
          action: "updateBoleto",
          data: {
            boletoId: boleto.id,
            updateData: values,
          },
        },
      });

      if (error) {
        console.error("Error updating boleto:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível atualizar o boleto.",
        });
        return;
      }

      toast({
        title: "Boleto atualizado com sucesso",
        description: "As informações do boleto foram atualizadas.",
      });
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao atualizar boleto.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!boleto) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Boleto</DialogTitle>
          <DialogDescription>
            Atualize as informações do boleto.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium mb-1">Empresa</p>
                <p className="text-sm">{boleto.companies?.name || "N/A"}</p>
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
                <p className="text-sm">{boleto.payer_tax_id}</p>
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

            <div className="pt-4 border-t space-y-4">
              <FormField
                control={form.control}
                name="status_emissao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status de Emissão</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Criado">Criado</SelectItem>
                        <SelectItem value="Emitido">Emitido</SelectItem>
                        <SelectItem value="Cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status_pagamento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status de Pagamento</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                      disabled={
                        form.watch("status_emissao") === "Criado" ||
                        form.watch("status_emissao") === "Cancelado"
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="N/A">N/A</SelectItem>
                        <SelectItem value="Pago">Pago</SelectItem>
                        <SelectItem value="Em Aberto">Em Aberto</SelectItem>
                        <SelectItem value="Em Atraso">Em Atraso</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nosso_numero"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nosso Número</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="linha_digitavel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Linha Digitável</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button variant="outline" onClick={onClose} disabled={isLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
