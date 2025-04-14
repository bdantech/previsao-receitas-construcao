import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
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
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { CompanySelect } from "@/components/companies/CompanySelect";
import { ProjectSelect } from "@/components/projects/ProjectSelect";

const formSchema = z.object({
  account_name: z.string().min(1, "Nome da conta é obrigatório"),
  account_number: z.string().min(1, "Número da conta é obrigatório"),
  balance: z.string().min(1, "Saldo é obrigatório"),
  bank_project_id: z.string().optional(),
  private_key: z.string().optional(),
  public_key: z.string().optional(),
  company_id: z.string().min(1, "Empresa é obrigatória"),
  project_id: z.string().min(1, "Projeto é obrigatório"),
  bank_account_url: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateBankAccountDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateBankAccountDialog: React.FC<CreateBankAccountDialogProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { getAuthHeader } = useAuth();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      account_name: "",
      account_number: "",
      balance: "0",
      bank_project_id: "",
      private_key: "",
      public_key: "",
      company_id: "",
      project_id: "",
      bank_account_url: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke("admin-bank-accounts", {
        body: {
          action: "create",
          ...values,
          balance: parseFloat(values.balance),
        },
        headers: getAuthHeader(),
      });

      if (error) {
        console.error("Error creating bank account:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível criar a conta bancária.",
        });
        return;
      }

      toast({
        title: "Conta bancária criada com sucesso",
        description: "A conta bancária foi adicionada ao sistema.",
      });

      onSuccess();
      onClose();
      form.reset();
    } catch (error) {
      console.error("Error:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao criar conta bancária.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nova Conta Bancária</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="company_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa</FormLabel>
                  <FormControl>
                    <CompanySelect
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="project_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Projeto</FormLabel>
                  <FormControl>
                    <ProjectSelect
                      value={field.value}
                      onChange={field.onChange}
                      companyId={form.watch("company_id")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="account_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Conta</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="account_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número da Conta</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="balance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Saldo</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      step="0.01"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bank_project_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ID do Projeto (Banco)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="private_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chave Privada</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="public_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chave Pública</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bank_account_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL da Conta Bancária</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Criar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}; 