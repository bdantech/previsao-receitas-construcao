import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Edit, FileText, Plus, RefreshCw, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

const formatReferenceMonth = (dateString: string) => {
  try {
    return format(new Date(dateString), "MMMM yyyy");
  } catch (error) {
    console.error("Error formatting date:", error);
    return dateString;
  }
};

const IndicesList = () => {
  const { getAuthHeader } = useAuth();
  const { data: indexes, isLoading } = useQuery({
    queryKey: ["indexes"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("indexes-management", {
        body: { action: "getIndexes" },
        headers: getAuthHeader()
      });
      
      if (error) throw new Error(error.message);
      return data.indexes;
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Índices</h2>
      </div>

      <Card>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="py-4 text-center">Carregando índices...</div>
          ) : indexes && indexes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {indexes.map((index: any) => (
                  <TableRow key={index.id}>
                    <TableCell className="font-medium">{index.name}</TableCell>
                    <TableCell>{index.description || "-"}</TableCell>
                    <TableCell>{index.type}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-4 text-center">Nenhum índice encontrado.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const IndexCalculator = () => {
  const { getAuthHeader } = useAuth();
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [selectedIndexId, setSelectedIndexId] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<any>(null);
  const [isCalculating, setIsCalculating] = React.useState(false);

  const { data: indexes } = useQuery({
    queryKey: ["indexes"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("indexes-management", {
        body: { action: "getIndexes" },
        headers: getAuthHeader()
      });
      
      if (error) throw new Error(error.message);
      return data.indexes;
    }
  });

  const handleCalculate = async () => {
    if (!selectedIndexId || !startDate || !endDate) {
      toast({
        variant: "destructive",
        description: "Preencha todos os campos para calcular",
      });
      return;
    }

    setIsCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke("indexes-management", {
        body: { 
          action: "calculateCompoundAdjustment", 
          data: { 
            indexId: selectedIndexId,
            startDate,
            endDate
          } 
        },
        headers: getAuthHeader()
      });
      
      if (error) throw new Error(error.message);
      setResult(data.compoundAdjustment);
    } catch (error) {
      toast({
        variant: "destructive",
        description: `Erro ao calcular: ${(error as Error).message}`,
      });
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Calculadora de Índices</h2>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="calcIndex">Índice</Label>
              <Select
                value={selectedIndexId || ""}
                onValueChange={(value) => setSelectedIndexId(value || null)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um índice" />
                </SelectTrigger>
                <SelectContent>
                  {indexes?.map((index: any) => (
                    <SelectItem key={index.id} value={index.id}>
                      {index.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Data Inicial</Label>
                <MonthYearPicker
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="Selecione mês/ano inicial"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="endDate">Data Final</Label>
                <MonthYearPicker
                  value={endDate}
                  onChange={setEndDate}
                  placeholder="Selecione mês/ano final"
                />
              </div>
            </div>
            
            <Button 
              className="w-full" 
              onClick={handleCalculate}
              disabled={isCalculating || !selectedIndexId || !startDate || !endDate}
            >
              {isCalculating ? "Calculando..." : "Calcular Reajuste Composto"}
            </Button>
            
            {result && (
              <div className="mt-6 p-4 border rounded-md bg-slate-50">
                <h3 className="font-medium text-lg mb-2">Resultado</h3>
                <div className="space-y-2">
                  <p>
                    <span className="font-medium">Reajuste Total:</span>{" "}
                    {result.percentage.toFixed(2)}%
                  </p>
                  <p>
                    <span className="font-medium">Fator Multiplicador:</span>{" "}
                    {result.factor.toFixed(6)}
                  </p>
                  <p>
                    <span className="font-medium">Meses Aplicados:</span>{" "}
                    {result.appliedMonths}
                  </p>
                  
                  {result.months && result.months.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium">Detalhamento mensal:</p>
                      <div className="max-h-40 overflow-y-auto mt-2">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Mês</TableHead>
                              <TableHead>Reajuste</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {result.months.map((month: any, index: number) => (
                              <TableRow key={index}>
                                <TableCell>{formatReferenceMonth(month.reference_month)}</TableCell>
                                <TableCell>{month.monthly_adjustment}%</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const indexUpdateSchema = z.object({
  indexId: z.string({
    required_error: "Selecione um índice",
  }),
  referenceMonth: z.string({
    required_error: "Informe o mês de referência",
  }).refine(value => {
    if (!value) return false;
    const pattern = /^\d{4}-\d{2}$/;
    if (!pattern.test(value)) return false;
    
    const [year, month] = value.split('-').map(Number);
    
    return !isNaN(year) && !isNaN(month) && month >= 1 && month <= 12;
  }, {
    message: "Formato de data inválido. Utilize o formato AAAA-MM.",
  }),
  monthlyAdjustment: z.coerce.number({
    required_error: "Informe o valor do ajuste",
  }).min(0, "O valor deve ser maior ou igual a 0"),
});

type IndexUpdateFormValues = z.infer<typeof indexUpdateSchema>;

const IndexUpdateDialog = ({ 
  isOpen, 
  onClose, 
  indexId: initialIndexId = null, 
  currentUpdate = null,
  allIndexes = [] 
}) => {
  const queryClient = useQueryClient();
  const { getAuthHeader } = useAuth();

  const form = useForm<IndexUpdateFormValues>({
    resolver: zodResolver(indexUpdateSchema),
    defaultValues: {
      indexId: initialIndexId || "",
      referenceMonth: currentUpdate?.reference_month ? format(new Date(currentUpdate.reference_month), "yyyy-MM") : "",
      monthlyAdjustment: currentUpdate?.monthly_adjustment || 0,
    },
  });

  React.useEffect(() => {
    if (isOpen) {
      form.reset({
        indexId: initialIndexId || currentUpdate?.index_id || "",
        referenceMonth: currentUpdate?.reference_month ? format(new Date(currentUpdate.reference_month), "yyyy-MM") : "",
        monthlyAdjustment: currentUpdate?.monthly_adjustment || 0,
      });
    }
  }, [isOpen, initialIndexId, currentUpdate, form]);

  const createMutation = useMutation({
    mutationFn: async (values: IndexUpdateFormValues) => {
      const { data, error } = await supabase.functions.invoke("indexes-management", {
        body: { 
          action: "createIndexUpdate",
          data: {
            indexId: values.indexId,
            referenceMonth: values.referenceMonth,
            monthlyAdjustment: values.monthlyAdjustment
          }
        },
        headers: getAuthHeader()
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Atualização criada",
        description: "A atualização do índice foi registrada com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["indexUpdates"] });
      onClose();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao criar atualização",
        description: error.message,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: IndexUpdateFormValues) => {
      const { data, error } = await supabase.functions.invoke("indexes-management", {
        body: { 
          action: "updateIndexUpdate",
          data: {
            id: currentUpdate.id,
            monthlyAdjustment: values.monthlyAdjustment
          }
        },
        headers: getAuthHeader()
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Atualização modificada",
        description: "A atualização do índice foi modificada com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["indexUpdates"] });
      onClose();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao modificar atualização",
        description: error.message,
      });
    },
  });

  const onSubmit = (values: IndexUpdateFormValues) => {
    if (currentUpdate) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] z-50">
        <DialogHeader>
          <DialogTitle>{currentUpdate ? "Editar Atualização" : "Nova Atualização"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="indexId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Índice</FormLabel>
                  <Select
                    disabled={currentUpdate || !!initialIndexId}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um índice" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="z-50 pointer-events-auto">
                      {allIndexes.map((index) => (
                        <SelectItem key={index.id} value={index.id}>
                          {index.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="referenceMonth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mês de Referência</FormLabel>
                  <FormControl>
                    <MonthYearPicker
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Selecione o mês/ano"
                      disabled={!!currentUpdate}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="monthlyAdjustment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ajuste Mensal (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {currentUpdate ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const UpdatesManagement = () => {
  const { getAuthHeader } = useAuth();
  const queryClient = useQueryClient();
  const [selectedIndexId, setSelectedIndexId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentUpdate, setCurrentUpdate] = useState(null);

  const { data: indexes, isLoading: isLoadingIndexes } = useQuery({
    queryKey: ["indexes"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("indexes-management", {
        body: { action: "getIndexes" },
        headers: getAuthHeader()
      });
      
      if (error) throw new Error(error.message);
      return data.indexes;
    }
  });

  const { data: indexUpdates, isLoading: isLoadingUpdates } = useQuery({
    queryKey: ["indexUpdates", selectedIndexId],
    queryFn: async () => {
      if (!selectedIndexId) return [];
      
      const { data, error } = await supabase.functions.invoke("indexes-management", {
        body: { 
          action: "getIndexUpdates",
          data: { indexId: selectedIndexId }
        },
        headers: getAuthHeader()
      });
      
      if (error) throw new Error(error.message);
      return data.updates;
    },
    enabled: !!selectedIndexId
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("indexes-management", {
        body: { 
          action: "deleteIndexUpdate",
          data: { id }
        },
        headers: getAuthHeader()
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Atualização excluída",
        description: "A atualização do índice foi excluída com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["indexUpdates"] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao excluir atualização",
        description: error.message,
      });
    },
  });

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta atualização?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleEdit = (update: any) => {
    setCurrentUpdate(update);
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    setCurrentUpdate(null);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setCurrentUpdate(null);
  };

  const selectedIndex = indexes?.find(index => index.id === selectedIndexId);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Atualizações de Índices</h2>
        <Button 
          onClick={handleAddNew} 
          disabled={!indexes || indexes.length === 0}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nova Atualização
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="space-y-6">
            <div className="max-w-md">
              <Label htmlFor="index-select">Selecione um índice</Label>
              <Select
                value={selectedIndexId || ""}
                onValueChange={(value) => setSelectedIndexId(value || null)}
                disabled={isLoadingIndexes}
              >
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Selecione um índice para ver as atualizações" />
                </SelectTrigger>
                <SelectContent>
                  {indexes?.map((index) => (
                    <SelectItem key={index.id} value={index.id}>
                      {index.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedIndexId && (
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-4">
                  Atualizações: {selectedIndex?.name}
                </h3>
                
                {isLoadingUpdates ? (
                  <div className="text-center py-4">Carregando atualizações...</div>
                ) : indexUpdates && indexUpdates.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mês de Referência</TableHead>
                        <TableHead>Ajuste Mensal (%)</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {indexUpdates.map((update) => (
                        <TableRow key={update.id}>
                          <TableCell>{formatReferenceMonth(update.reference_month)}</TableCell>
                          <TableCell>{update.monthly_adjustment}%</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="outline" 
                                size="icon" 
                                onClick={() => handleEdit(update)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="icon" 
                                onClick={() => handleDelete(update.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-4 border rounded-md bg-muted/20">
                    Nenhuma atualização encontrada para este índice.
                  </div>
                )}
              </div>
            )}

            {!selectedIndexId && !isLoadingIndexes && (
              <div className="text-center py-6 text-muted-foreground">
                Selecione um índice para visualizar e gerenciar suas atualizações.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <IndexUpdateDialog 
        isOpen={isDialogOpen} 
        onClose={closeDialog} 
        indexId={selectedIndexId}
        currentUpdate={currentUpdate}
        allIndexes={indexes || []}
      />
    </div>
  );
};

const AdminSettingsPage = () => {
  return (
    <>
      <div className="container mx-auto py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-muted-foreground mt-2">Gerencie índices e outras configurações do sistema</p>
        </div>
        
        <Tabs defaultValue="calculator" className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="calculator" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              <span>Calculadora</span>
            </TabsTrigger>
            <TabsTrigger value="indexes" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>Índices</span>
            </TabsTrigger>
            <TabsTrigger value="updates" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              <span>Atualizações</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="calculator">
            <IndexCalculator />
          </TabsContent>
          
          <TabsContent value="indexes">
            <IndicesList />
          </TabsContent>
          
          <TabsContent value="updates">
            <UpdatesManagement />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default AdminSettingsPage;
