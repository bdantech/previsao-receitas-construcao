
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
