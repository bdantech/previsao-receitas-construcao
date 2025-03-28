
import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { AdminDashboardLayout } from "@/components/dashboard/AdminDashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, RefreshCw } from "lucide-react";

// Helper function to format reference month
const formatReferenceMonth = (dateString: string) => {
  try {
    return format(new Date(dateString), "MMMM yyyy");
  } catch (error) {
    console.error("Error formatting date:", error);
    return dateString;
  }
};

// Indices List Component
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

// Atualizações component
const UpdatesManagement = () => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Atualizações</h2>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">Esta funcionalidade está em desenvolvimento.</p>
            <Button variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Verificar atualizações
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Main page component
const AdminSettingsPage = () => {
  return (
    <AdminDashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Configurações</h1>
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
    </AdminDashboardLayout>
  );
};

export default AdminSettingsPage;
