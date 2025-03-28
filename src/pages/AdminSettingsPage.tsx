import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminDashboardLayout } from "@/components/dashboard/AdminDashboardLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

// Helper function to format reference month
const formatReferenceMonth = (dateString: string) => {
  const date = new Date(dateString);
  // Format as "Month Year" in Portuguese
  return format(date, "MMMM yyyy");
};

// Index management tab
const IndexesTab = () => {
  const { getAuthHeader } = useAuth();
  const [isIndexDialogOpen, setIsIndexDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [currentIndex, setCurrentIndex] = React.useState<any>(null);
  const queryClient = useQueryClient();

  // Fetch indexes
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

  // Create/update index
  const indexMutation = useMutation({
    mutationFn: async (values: { id?: string; name: string; description: string }) => {
      const action = values.id ? "updateIndex" : "createIndex";
      const { data, error } = await supabase.functions.invoke("indexes-management", {
        body: { action, data: values },
        headers: getAuthHeader()
      });
      
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["indexes"] });
      setIsIndexDialogOpen(false);
      setCurrentIndex(null);
      toast({
        description: currentIndex ? "Índice atualizado com sucesso" : "Índice criado com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        description: `Erro: ${error.message}`,
      });
    }
  });

  // Delete index
  const deleteIndexMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("indexes-management", {
        body: { action: "deleteIndex", data: { id } },
        headers: getAuthHeader()
      });
      
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["indexes"] });
      setIsDeleteDialogOpen(false);
      setCurrentIndex(null);
      toast({
        description: "Índice excluído com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        description: `Erro: ${error.message}`,
      });
    }
  });

  // Form state
  const [formValues, setFormValues] = React.useState({
    name: "",
    description: ""
  });

  const handleOpenIndexDialog = (index?: any) => {
    if (index) {
      setCurrentIndex(index);
      setFormValues({
        name: index.name,
        description: index.description || ""
      });
    } else {
      setCurrentIndex(null);
      setFormValues({
        name: "",
        description: ""
      });
    }
    setIsIndexDialogOpen(true);
  };

  const handleOpenDeleteDialog = (index: any) => {
    setCurrentIndex(index);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    indexMutation.mutate(
      currentIndex 
        ? { ...formValues, id: currentIndex.id } 
        : formValues
    );
  };

  const handleDelete = () => {
    if (currentIndex?.id) {
      deleteIndexMutation.mutate(currentIndex.id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Índices</h2>
        <Button onClick={() => handleOpenIndexDialog()}>
          <Plus className="mr-2 h-4 w-4" /> Novo Índice
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          {isLoading ? (
            <p>Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {indexes?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">Nenhum índice encontrado</TableCell>
                  </TableRow>
                )}
                {indexes?.map((index) => (
                  <TableRow key={index.id}>
                    <TableCell className="font-medium">{index.name}</TableCell>
                    <TableCell>{index.description}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenIndexDialog(index)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDeleteDialog(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Index Dialog */}
      <Dialog open={isIndexDialogOpen} onOpenChange={setIsIndexDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentIndex ? "Editar Índice" : "Novo Índice"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Índice</Label>
              <Input
                id="name"
                value={formValues.name}
                onChange={(e) => setFormValues({ ...formValues, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formValues.description}
                onChange={(e) => setFormValues({ ...formValues, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsIndexDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={indexMutation.isPending}>
                {indexMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
          </DialogHeader>
          <p>Tem certeza que deseja excluir o índice "{currentIndex?.name}"?</p>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete} 
              disabled={deleteIndexMutation.isPending}
            >
              {deleteIndexMutation.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Index updates tab
const IndexUpdatesTab = () => {
  const { getAuthHeader } = useAuth();
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [currentUpdate, setCurrentUpdate] = React.useState<any>(null);
  const [selectedIndexId, setSelectedIndexId] = React.useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch indexes for dropdown
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

  // Fetch index updates
  const { data: updates, isLoading } = useQuery({
    queryKey: ["indexUpdates", selectedIndexId],
    queryFn: async () => {
      if (!selectedIndexId) return [];
      
      const { data, error } = await supabase.functions.invoke("indexes-management", {
        body: { action: "getIndexUpdates", data: { indexId: selectedIndexId } },
        headers: getAuthHeader()
      });
      
      if (error) throw new Error(error.message);
      return data.updates;
    },
    enabled: !!selectedIndexId
  });

  // Create/update index update
  const updateMutation = useMutation({
    mutationFn: async (values: { id?: string; indexId: string; referenceMonth: string; monthlyAdjustment: number }) => {
      const action = values.id ? "updateIndexUpdate" : "createIndexUpdate";
      const { data, error } = await supabase.functions.invoke("indexes-management", {
        body: { action, data: values },
        headers: getAuthHeader()
      });
      
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["indexUpdates", selectedIndexId] });
      setIsUpdateDialogOpen(false);
      setCurrentUpdate(null);
      toast({
        description: currentUpdate ? "Atualização modificada com sucesso" : "Atualização criada com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        description: `Erro: ${error.message}`,
      });
    }
  });

  // Delete index update
  const deleteUpdateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("indexes-management", {
        body: { action: "deleteIndexUpdate", data: { id } },
        headers: getAuthHeader()
      });
      
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["indexUpdates", selectedIndexId] });
      setIsDeleteDialogOpen(false);
      setCurrentUpdate(null);
      toast({
        description: "Atualização excluída com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        description: `Erro: ${error.message}`,
      });
    }
  });

  // Form state
  const [formValues, setFormValues] = React.useState({
    referenceMonth: "",
    monthlyAdjustment: ""
  });

  const handleOpenUpdateDialog = (update?: any) => {
    if (update) {
      setCurrentUpdate(update);
      // Format date to YYYY-MM for input
      const date = new Date(update.reference_month);
      const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      setFormValues({
        referenceMonth: formattedDate,
        monthlyAdjustment: update.monthly_adjustment.toString()
      });
    } else {
      setCurrentUpdate(null);
      setFormValues({
        referenceMonth: "",
        monthlyAdjustment: ""
      });
    }
    setIsUpdateDialogOpen(true);
  };

  const handleOpenDeleteDialog = (update: any) => {
    setCurrentUpdate(update);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedIndexId) {
      toast({
        variant: "destructive",
        description: "Selecione um índice primeiro",
      });
      return;
    }
    
    updateMutation.mutate({
      ...(currentUpdate ? { id: currentUpdate.id } : {}),
      indexId: selectedIndexId,
      referenceMonth: formValues.referenceMonth,
      monthlyAdjustment: parseFloat(formValues.monthlyAdjustment)
    });
  };

  const handleDelete = () => {
    if (currentUpdate?.id) {
      deleteUpdateMutation.mutate(currentUpdate.id);
    }
  };

  const formatReferenceMonth = (dateString: string) => {
    const date = new Date(dateString);
    // Format as "Month Year" in Portuguese
    return format(date, "MMMM yyyy");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Atualizações de Índices</h2>
        <Button 
          onClick={() => handleOpenUpdateDialog()}
          disabled={!selectedIndexId}
        >
          <Plus className="mr-2 h-4 w-4" /> Nova Atualização
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="indexSelect">Selecione um Índice</Label>
        <select
          id="indexSelect"
          className="w-full p-2 border rounded"
          value={selectedIndexId || ""}
          onChange={(e) => setSelectedIndexId(e.target.value || null)}
        >
          <option value="">Selecione um índice</option>
          {indexes?.map((index) => (
            <option key={index.id} value={index.id}>{index.name}</option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="p-6">
          {!selectedIndexId ? (
            <p className="text-center py-4">Selecione um índice para ver suas atualizações</p>
          ) : isLoading ? (
            <p>Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês de Referência</TableHead>
                  <TableHead>Reajuste Mensal (%)</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {updates?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">Nenhuma atualização encontrada</TableCell>
                  </TableRow>
                )}
                {updates?.map((update) => (
                  <TableRow key={update.id}>
                    <TableCell>{formatReferenceMonth(update.reference_month)}</TableCell>
                    <TableCell>{update.monthly_adjustment}%</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenUpdateDialog(update)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDeleteDialog(update)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Update Dialog */}
      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentUpdate ? "Editar Atualização" : "Nova Atualização"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="referenceMonth">Mês de Referência</Label>
              <Input
                id="referenceMonth"
                type="month"
                value={formValues.referenceMonth}
                onChange={(e) => setFormValues({ ...formValues, referenceMonth: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthlyAdjustment">Reajuste Mensal (%)</Label>
              <Input
                id="monthlyAdjustment"
                type="number"
                step="0.01"
                value={formValues.monthlyAdjustment}
                onChange={(e) => setFormValues({ ...formValues, monthlyAdjustment: e.target.value })}
                required
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsUpdateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
          </DialogHeader>
          <p>Tem certeza que deseja excluir esta atualização de índice?</p>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete} 
              disabled={deleteUpdateMutation.isPending}
            >
              {deleteUpdateMutation.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Calculator component for compound adjustments
const IndexCalculator = () => {
  const { getAuthHeader } = useAuth();
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [selectedIndexId, setSelectedIndexId] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<any>(null);
  const [isCalculating, setIsCalculating] = React.useState(false);

  // Fetch indexes for dropdown
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
              <select
                id="calcIndex"
                className="w-full p-2 border rounded"
                value={selectedIndexId || ""}
                onChange={(e) => setSelectedIndexId(e.target.value || null)}
              >
                <option value="">Selecione um índice</option>
                {indexes?.map((index) => (
                  <option key={index.id} value={index.id}>{index.name}</option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Data Inicial</Label>
                <Input
                  id="startDate"
                  type="month"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="endDate">Data Final</Label>
                <Input
                  id="endDate"
                  type="month"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
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

// Main Settings Page
const AdminSettingsPage = () => {
  return (
    <AdminDashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground">
            Gerencie índices e atualizações de índices
          </p>
        </div>

        <Tabs defaultValue="indexes" className="space-y-4">
          <TabsList>
            <TabsTrigger value="indexes">Índices</TabsTrigger>
            <TabsTrigger value="updates">Atualizações</TabsTrigger>
            <TabsTrigger value="calculator">Calculadora</TabsTrigger>
          </TabsList>
          
          <TabsContent value="indexes" className="space-y-4">
            <IndexesTab />
          </TabsContent>
          
          <TabsContent value="updates" className="space-y-4">
            <IndexUpdatesTab />
          </TabsContent>
          
          <TabsContent value="calculator" className="space-y-4">
            <IndexCalculator />
          </TabsContent>
        </Tabs>
      </div>
    </AdminDashboardLayout>
  );
};

export default AdminSettingsPage;
