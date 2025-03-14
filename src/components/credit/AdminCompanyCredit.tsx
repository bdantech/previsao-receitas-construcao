import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, AlertCircle } from "lucide-react";
import { CreditAnalysisDialog } from "./CreditAnalysisDialog";
import { Badge } from "@/components/ui/badge";

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

interface AdminCompanyCreditProps {
  companyId: string;
  companyName: string;
}

export function AdminCompanyCredit({ companyId, companyName }: AdminCompanyCreditProps) {
  const [creditAnalyses, setCreditAnalyses] = useState<CreditAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<CreditAnalysis | null>(null);
  const { getAuthHeader } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchCreditAnalyses();
  }, [companyId]);

  const fetchCreditAnalyses = async () => {
    try {
      setLoading(true);
      const response = await supabase.functions.invoke('admin-company-credit', {
        method: 'POST',
        headers: await getAuthHeader(),
        body: {
          action: 'list',
          companyId
        }
      });

      if (response.error) throw response.error;
      
      // Extract the data from the response
      const responseData = response.data;
      
      console.log('Credit analyses response:', responseData);
      
      // Check if the data is in the expected format
      if (responseData && responseData.success && responseData.data) {
        // Ensure data is always an array, even if empty
        setCreditAnalyses(Array.isArray(responseData.data) ? responseData.data : []);
      } else {
        // Handle legacy format or unexpected format
        setCreditAnalyses(Array.isArray(responseData) ? responseData : []);
      }
    } catch (error: any) {
      console.error("Error fetching credit analyses:", error);
      toast({
        title: "Error",
        description: "Failed to load credit analyses: " + error.message,
        variant: "destructive",
      });
      // Set to empty array on error to prevent map issues
      setCreditAnalyses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnalysis = () => {
    setSelectedAnalysis(null);
    setDialogOpen(true);
  };

  const handleEditAnalysis = (analysis: CreditAnalysis) => {
    setSelectedAnalysis(analysis);
    setDialogOpen(true);
  };

  const handleSaveAnalysis = async (analysisData: Partial<CreditAnalysis>) => {
    try {
      let result;
      
      if (selectedAnalysis) {
        // Update existing analysis
        const response = await supabase.functions.invoke('admin-company-credit', {
          method: 'POST',
          headers: await getAuthHeader(),
          body: {
            action: 'update',
            analysisId: selectedAnalysis.id,
            analysisData
          }
        });
        
        if (response.error) throw response.error;
        
        // Extract the data from the response
        result = response.data && response.data.success && response.data.data 
          ? response.data.data 
          : response.data;
          
        toast({
          title: "Success",
          description: "Credit analysis updated successfully",
          variant: "default",
        });
      } else {
        // Create new analysis
        const response = await supabase.functions.invoke('admin-company-credit', {
          method: 'POST',
          headers: await getAuthHeader(),
          body: {
            action: 'create',
            companyId,
            analysisData: {
              ...analysisData,
              consumed_credit: analysisData.consumed_credit || 0
            }
          }
        });
        
        if (response.error) throw response.error;
        
        // Extract the data from the response
        result = response.data && response.data.success && response.data.data 
          ? response.data.data 
          : response.data;
          
        toast({
          title: "Success",
          description: "Credit analysis created successfully",
          variant: "default",
        });
      }
      
      console.log('Save result:', result);
      setDialogOpen(false);
      fetchCreditAnalyses();
    } catch (error: any) {
      console.error("Error saving credit analysis:", error);
      toast({
        title: "Error",
        description: "Failed to save credit analysis: " + error.message,
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value}%`;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Análise de Crédito</h2>
        <Button onClick={handleCreateAnalysis}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Nova Análise de Crédito
        </Button>
      </div>

      {loading ? (
        <p>Carregando análises de crédito...</p>
      ) : creditAnalyses.length === 0 ? (
        <Card>
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Nenhuma análise de crédito</h3>
            <p className="text-muted-foreground mt-2">
              Esta empresa não possui análises de crédito cadastradas.
            </p>
            <Button onClick={handleCreateAnalysis} className="mt-4">
              <PlusCircle className="mr-2 h-4 w-4" />
              Criar Primeira Análise
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {creditAnalyses.map((analysis) => (
            <Card key={analysis.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">
                    Análise de Crédito
                    <Badge 
                      className="ml-2" 
                      variant={analysis.status === 'Ativa' ? 'success' : 'default'}
                    >
                      {analysis.status}
                    </Badge>
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => handleEditAnalysis(analysis)}>
                    <Edit className="h-4 w-4 mr-1" /> Editar
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Criado em: {new Date(analysis.created_at).toLocaleDateString('pt-BR')}
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm font-medium">Limite de Crédito</p>
                    <p className="text-lg">{formatCurrency(analysis.credit_limit)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Crédito Consumido</p>
                    <p className="text-lg">{formatCurrency(analysis.consumed_credit)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Crédito Disponível</p>
                    <p className="text-lg">{formatCurrency(analysis.available_credit)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Taxa de Juros (até 180 dias)</p>
                    <p>{formatPercentage(analysis.interest_rate_180)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Taxa de Juros (até 360 dias)</p>
                    <p>{formatPercentage(analysis.interest_rate_360)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Taxa de Juros (até 720 dias)</p>
                    <p>{formatPercentage(analysis.interest_rate_720)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Taxa de Juros (Longo Prazo)</p>
                    <p>{formatPercentage(analysis.interest_rate_long_term)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Tarifa por Recebível</p>
                    <p>{formatCurrency(analysis.fee_per_receivable)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreditAnalysisDialog 
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        companyName={companyName}
        onSave={handleSaveAnalysis}
        initialData={selectedAnalysis}
      />
    </div>
  );
}
