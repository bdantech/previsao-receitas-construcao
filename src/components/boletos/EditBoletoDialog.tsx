
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
import { Loader2, Download } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Boleto } from "./BoletosTable";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
  const [uploadingFile, setUploadingFile] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const { toast } = useToast();
  const { getAuthHeader } = useAuth();

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
      // Reset file state when boleto changes
      setFile(null);
    }
  }, [boleto, form]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  // Function to download the existing boleto file
  const handleDownloadFile = async () => {
    if (!boleto || !boleto.arquivo_boleto_path) return;
    
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(boleto.arquivo_boleto_path);
      
      if (error) {
        console.error("Error downloading file:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: `Erro ao baixar o arquivo: ${error.message}`,
        });
        return;
      }
      
      // Create a download link and trigger the download
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = boleto.arquivo_boleto_name || 'boleto.pdf';
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error in download function:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao baixar o arquivo do boleto.",
      });
    }
  };

  const uploadBoletoFile = async (boletoId: string, file: File) => {
    setUploadingFile(true);
    try {
      // Create a unique file path with timestamp to avoid conflicts
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const filePath = `boletos/${boletoId}/${timestamp}_${file.name}`;
      
      console.log("Uploading file to path:", filePath);
      
      // Upload the file to the documents bucket
      const { data: storageData, error: storageError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });
      
      if (storageError) {
        console.error("Error uploading file:", storageError);
        throw new Error(`Error uploading file: ${storageError.message}`);
      }
      
      console.log("File uploaded successfully:", storageData);
      
      // Update boleto record with file path and name
      const { data, error } = await supabase.functions.invoke("admin-boletos", {
        body: {
          action: "updateBoleto",
          data: {
            boletoId,
            updateData: {
              arquivo_boleto_path: filePath,
              arquivo_boleto_name: file.name
            },
          },
        },
        headers: getAuthHeader(),
      });

      if (error) {
        console.error("Error updating boleto with file info:", error);
        throw new Error(`Error updating boleto: ${error.message}`);
      }
      
      toast({
        title: "Arquivo enviado com sucesso",
        description: "O arquivo do boleto foi enviado e associado ao registro.",
      });
      
      return data;
    } catch (error) {
      console.error("Error in uploadBoletoFile:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao enviar o arquivo do boleto.",
      });
      throw error;
    } finally {
      setUploadingFile(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    if (!boleto) return;

    setIsLoading(true);
    try {
      // Add auth headers to the request
      const { data, error } = await supabase.functions.invoke("admin-boletos", {
        body: {
          action: "updateBoleto",
          data: {
            boletoId: boleto.id,
            updateData: values,
          },
        },
        headers: getAuthHeader(), // Add authentication headers
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

      // If there's a file to upload, do it after updating the boleto
      if (file) {
        await uploadBoletoFile(boleto.id, file);
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

              <div className="space-y-2">
                <FormLabel>Arquivo do Boleto</FormLabel>
                <div className="border border-input rounded-md p-2">
                  <div className="flex flex-col gap-2">
                    <Input 
                      type="file" 
                      id="boleto-file" 
                      onChange={handleFileChange}
                      accept=".pdf,.png,.jpg,.jpeg"
                      className="flex-1" 
                    />
                    
                    {boleto.arquivo_boleto_name && (
                      <div className="flex items-center justify-between text-sm text-muted-foreground p-2 bg-muted rounded-md">
                        <span>Arquivo atual: {boleto.arquivo_boleto_name}</span>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm"
                          onClick={handleDownloadFile}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Baixar
                        </Button>
                      </div>
                    )}
                    
                    {file && (
                      <div className="text-sm text-muted-foreground p-2 bg-muted rounded-md">
                        Novo arquivo: {file.name}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Faça upload do arquivo do boleto (PDF ou imagem)
                </p>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button variant="outline" onClick={onClose} disabled={isLoading || uploadingFile}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading || uploadingFile}>
                {(isLoading || uploadingFile) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {uploadingFile ? "Enviando arquivo..." : "Salvando..."}
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
