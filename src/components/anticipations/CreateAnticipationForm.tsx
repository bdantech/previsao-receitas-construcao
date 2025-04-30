 
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatCNPJ, formatCPF, formatCurrency } from "@/lib/formatters";
import { onlyNumbers } from "@/utils/helpers/onlyNumbers.helper";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Loader } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnticipationTerms } from "./Terms";

interface Receivable {
  id: string;
  buyer_name?: string;
  buyer_cpf: string;
  amount: number;
  due_date: string;
  description?: string;
  status: string;
  projects?: {
    name: string;
  };
}

interface CreditAnalysis {
  interest_rate_180: number;
  interest_rate_360: number;
  interest_rate_720: number;
  interest_rate_long_term: number;
  fee_per_receivable: number;
  operation_days_limit: number;
}

interface CalculationResult {
  valorTotal: number;
  valorLiquido: number;
  quantidade: number;
  taxas: CreditAnalysis;
}

type TDataToPdf = {
  projectId: string;
  cedente: {
    razaoSocial: string;
    cnpj: string;
  };
  recebiveis: {
    comprador: string;
    cpf: string;
    vencimento: string;
    valor: string;
    linkContrato?: string
  }[];
  valores: {
    valorTotalCreditosVencimento: number;
    precoPagoCessao: number;
    formaPagamento: string;
    descontos: number;
    valorLiquidoPagoAoCedente: number;
    dataPagamento: string;
  };
  user: {
    email: string;
  };
};

const CreateAnticipationForm = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session,getAuthHeader, user } = useAuth();
  console.log(user)
  
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [selectedReceivables, setSelectedReceivables] = useState<Receivable[]>([]);
  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companyData, setCompanyData] = useState<{ id: string; name: string, cnpj: string } | null>(null);
  const [operationDaysLimit, setOperationDaysLimit] = useState<number | null>(null);
  const reportTemplateRef = useRef(null)
  const [recebiveisState, setRecebiveisState] = useState<TDataToPdf['recebiveis']>([])

  // Add useEffect to log operationDaysLimit changes
  useEffect(() => {
    console.log('Operation Days Limit:', operationDaysLimit);
  }, [operationDaysLimit]);
  
  // Add function to check if a receivable is within the operation days limit
  const isReceivableWithinLimit = (receivable: Receivable) => {
    if (!operationDaysLimit) return true;
    
    const today = new Date();
    const dueDate = new Date(receivable.due_date);
    const daysToDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    return daysToDue <= operationDaysLimit;
  };
  
  // Fetch receivables and company data
  useEffect(() => {
    const fetchData = async () => {
      if (!session?.access_token || !projectId) return;
      
      setIsLoading(true);
      try {
        // Get project data to get company ID
        const { data: projectData, error: projectError } = await supabase.functions.invoke('project-management', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: {
            method: 'GET',
            endpoint: `projects/${projectId}`
          }
        });
        
        if (projectError) {
          throw projectError;
        }
        
        // Check if project data exists and has the expected structure
        if (!projectData || !projectData.project) {
          throw new Error('Project data not found');
        }
        
        // Store company data - Note that company name might be stored differently
        // First, try to access it from the expected path
        let companyName = '';
        let companyCnpj = '';
        
        // Check if we have company data in a nested structure
        if (projectData.project.companies && projectData.project.companies.name) {
          companyName = projectData.project.companies.name;
        } else {
          // Fetch company name separately if needed
          const { data: companyResult } = await supabase.functions.invoke('company-data', {
            method: 'POST',
            headers: await getAuthHeader(),
            body: {
              action: 'getCompanyDetails',
              companyId: projectData.project.company_id
            }
          });
          console.log('companyResult')
          console.log(companyResult)
          if (companyResult && companyResult.company) {
            companyName = companyResult.company.name;
            companyCnpj = companyResult.company.cnpj;
          } else {
            companyName = 'Company';  // Fallback name
            companyCnpj = '00.000.000/0000-00';  // Fallback CNPJ
          }
        }
        console.log('projectData')
        console.log(projectData)
        setCompanyData({
          id: projectData.project.company_id,
          name: companyName,
          cnpj: companyCnpj,
        });
        
        // Get the active credit analysis for the company
        const { data: creditAnalysisData, error: creditAnalysisError } = await supabase
          .rpc('get_active_credit_analysis_for_company', {
            p_company_id: projectData.project.company_id
          });

        console.log('Credit Analysis Data:', creditAnalysisData);
        console.log('Credit Analysis Error:', creditAnalysisError);

        if (creditAnalysisError) {
          console.error('Error fetching credit analysis:', creditAnalysisError);
          throw new Error('Não foi possível obter a análise de crédito da empresa');
        }

        // Check if we got a valid result
        if (!creditAnalysisData) {
          console.log('No credit analysis data found');
          throw new Error('Não foi encontrada análise de crédito ativa para esta empresa');
        }

        // Set the operation days limit
        const creditAnalysis = creditAnalysisData as unknown as CreditAnalysis;
        console.log('Parsed Credit Analysis:', creditAnalysis);
        setOperationDaysLimit(creditAnalysis.operation_days_limit);
        
        // Get receivables eligible for anticipation
        const response = await supabase.functions.invoke('company-anticipations', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: {
            action: 'getReceivablesForAnticipation',
            projectId,
            companyId: projectData.project.company_id
          }
        });
        
        if (response.error) {
          throw response.error;
        }
        
        setReceivables(response.data?.receivables || []);
      } catch (error) {
        console.error('Error fetching receivables:', error);
        toast({
          title: "Erro ao carregar recebíveis",
          description: "Não foi possível obter a lista de recebíveis elegíveis para antecipação.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [session, projectId, toast]);
  
  // Calculate total amount of selected receivables
  const totalSelectedAmount = selectedReceivables.reduce((sum, receivable) => sum + Number(receivable.amount), 0);
  
  // Toggle receivable selection
  const toggleReceivable = (receivable: Receivable) => {
    if (!isReceivableWithinLimit(receivable)) {
      toast({
        title: "Recebível fora do prazo",
        description: `Este recebível possui vencimento além do limite de ${operationDaysLimit} dias.`,
        variant: "destructive"
      });
      return;
    }

    if (selectedReceivables.some(r => r.id === receivable.id)) {
      setSelectedReceivables(selectedReceivables.filter(r => r.id !== receivable.id));
    } else {
      setSelectedReceivables([...selectedReceivables, receivable]);
    }
  };
  
  // Select all receivables
  const selectAllReceivables = () => {
    const eligibleReceivables = receivables.filter(isReceivableWithinLimit);
    setSelectedReceivables(eligibleReceivables);
    
    if (eligibleReceivables.length < receivables.length) {
      toast({
        title: "Alguns recebíveis não foram selecionados",
        description: `Apenas recebíveis com vencimento dentro de ${operationDaysLimit} dias foram selecionados.`,
        variant: "default"
      });
    }
  };
  
  // Deselect all receivables
  const deselectAllReceivables = () => {
    setSelectedReceivables([]);
  };
  
  // Handle continue to next step
  const handleContinue = async () => {
    if (step === 1) {
      if (selectedReceivables.length === 0) {
        toast({
          title: "Selecione pelo menos um recebível",
          description: "Você precisa selecionar pelo menos um recebível para continuar.",
          variant: "destructive"
        });
        return;
      }
      
      // Calculate anticipated value
      try {
        setIsLoading(true);
        
        // Get the credit analysis for the company using a raw SQL query to avoid ambiguous column references
        const { data: creditAnalysisData, error: creditAnalysisError } = await supabase
          .rpc('get_active_credit_analysis_for_company', {
            p_company_id: companyData?.id
          });

        if (creditAnalysisError) {
          console.error('Error fetching credit analysis:', creditAnalysisError);
          throw new Error('Não foi possível obter a análise de crédito da empresa');
        }

        // Check if we got a valid result
        if (!creditAnalysisData) {
          throw new Error('Não foi encontrada análise de crédito ativa para esta empresa');
        }

        // Cast the credit analysis to the proper type
        const creditAnalysis = creditAnalysisData as unknown as CreditAnalysis;

        // Calculate values directly in the frontend
        const valorTotal = selectedReceivables.reduce((total, rec) => total + Number(rec.amount), 0);
        const quantidade = selectedReceivables.length;
        
        // Calculate interest deduction for each receivable
        let valorLiquido = 0;
        const today = new Date();
        
        for (const receivable of selectedReceivables) {
          const dueDate = new Date(receivable.due_date);
          const daysTodue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          // Get appropriate interest rate based on days to due
          let interestRate;
          if (daysTodue <= 180) {
            interestRate = creditAnalysis.interest_rate_180;
          } else if (daysTodue <= 360) {
            interestRate = creditAnalysis.interest_rate_360;
          } else if (daysTodue <= 720) {
            interestRate = creditAnalysis.interest_rate_720;
          } else {
            interestRate = creditAnalysis.interest_rate_long_term;
          }
          
          // Calculate net value for this receivable using the new formula
          const valorLiquidoRecebivel = receivable.amount - ((receivable.amount * (Math.pow((interestRate/100 + 1), daysTodue/30))) - receivable.amount) - creditAnalysis.fee_per_receivable;
          valorLiquido += valorLiquidoRecebivel;
        }
        
        // Set calculation result
        setCalculationResult({
          valorTotal,
          valorLiquido,
          quantidade,
          taxas: creditAnalysis
        });
        
        setStep(2);
      } catch (error) {
        console.error('Error calculating anticipated value:', error);
        toast({
          title: "Erro ao calcular valor antecipado",
          description: error instanceof Error ? error.message : "Não foi possível calcular o valor antecipado. Tente novamente.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    } else if (step === 2) {
      setStep(3);
    }
  };
  
  // Handle back button
  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    if (!companyData?.id || !projectId || !calculationResult) return;
    
    try {
      setIsSubmitting(true);
      
      const response = await supabase.functions.invoke('company-anticipations', {
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        },
        body: {
          action: 'createAnticipation',
          companyId: companyData.id,
          projectId,
          receivableIds: selectedReceivables.map(r => r.id),
          valorTotal: calculationResult.valorTotal,
          valorLiquido: calculationResult.valorLiquido,
          taxaJuros180: calculationResult.taxas.interest_rate_180,
          taxaJuros360: calculationResult.taxas.interest_rate_360,
          taxaJuros720: calculationResult.taxas.interest_rate_720,
          taxaJurosLongoPrazo: calculationResult.taxas.interest_rate_long_term,
          tarifaPorRecebivel: calculationResult.taxas.fee_per_receivable,
          dataToPdf: {
            user: {
              email: user.email,
            },
            cedente:{
              razaoSocial: companyData.name,
              cnpj: formatCNPJ(companyData.cnpj),
            },
            recebiveis: recebiveisState,
            valores:{
              dataPagamento: format(new Date(), 'dd/MM/yyyy', { locale: ptBR }),
              descontos: calculationResult.taxas.fee_per_receivable,
              formaPagamento: "A Vista",
              precoPagoCessao: calculationResult.valorLiquido,
              valorLiquidoPagoAoCedente: calculationResult.valorLiquido,
              valorTotalCreditosVencimento: calculationResult.valorTotal,
            }
          },
        }
      });
      
      if (response.error) {
        throw response.error;
      }
      
      toast({
        title: "Antecipação solicitada com sucesso",
        description: "Sua solicitação de antecipação foi enviada e está em análise.",
      });
      
      // Redirect back to Project Dashboard, Antecipações tab
      navigate(`/project-dashboard/${projectId}?tab=antecipacoes`);
    } catch (error) {
      console.error('Error creating anticipation:', error);
      toast({
        title: "Erro ao criar antecipação",
        description: "Não foi possível criar a solicitação de antecipação. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (step !== 3) return;
    const fetchBuyers = async () => {
      setRecebiveisState([]);
      selectedReceivables.map(async (item, index) => {
        const { data } = await supabase.functions.invoke('project-buyers', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: { 
            action: 'filterByCpfAndProject',
            projectId,
            buyerData: {
              cpf: onlyNumbers(item.buyer_cpf)
            }
          }
        });

        if (data) {
          setRecebiveisState((prev) => [
            ...prev,
            {
              comprador: item.buyer_name || "—",
              cpf: formatCPF(item.buyer_cpf),
              valor: formatCurrency(item.amount),
              vencimento: format(new Date(item.due_date), 'dd/MM/yyyy', { locale: ptBR }),
              linkContrato: `${import.meta.env.VITE_APP_URL}/public/buyer/${data.id}/contract`
            }
          ])
        }
      })
    }

    fetchBuyers()
  }, [step])
  
  // Render loading state
  if (isLoading && step === 1 && receivables.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader className="mx-auto h-8 w-8 animate-spin text-gray-500" />
          <p className="mt-2 text-gray-500">Carregando recebíveis...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container max-w-4xl mx-auto py-8">
      {/* Step indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1">
            <div className={`h-2 rounded-l-full ${step >= 1 ? 'bg-primary' : 'bg-gray-200'}`}></div>
          </div>
          <div className="flex-1">
            <div className={`h-2 ${step >= 2 ? 'bg-primary' : 'bg-gray-200'}`}></div>
          </div>
          <div className="flex-1">
            <div className={`h-2 rounded-r-full ${step === 3 ? 'bg-primary' : 'bg-gray-200'}`}></div>
          </div>
        </div>
        <div className="flex justify-between text-sm">
          <div className={step >= 1 ? 'text-primary font-medium' : 'text-gray-500'}>
            Selecionar Recebíveis
          </div>
          <div className={step >= 2 ? 'text-primary font-medium' : 'text-gray-500'}>
            Revisar Valores
          </div>
          <div className={step === 3 ? 'text-primary font-medium' : 'text-gray-500'}>
            Confirmar
          </div>
        </div>
      </div>
      
      <Card className="w-full">
        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle>Selecione os recebíveis para antecipação</CardTitle>
              <CardDescription>
                Escolha um ou mais recebíveis elegíveis para antecipar
              </CardDescription>
            </CardHeader>
            <CardContent>
              {operationDaysLimit && (
                <div className="mb-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex items-center gap-2 text-primary">
                    <AlertCircle className="h-5 w-5" />
                    <p className="text-sm">
                      Você pode antecipar os seus recebíveis que possuem um vencimento máximo de {operationDaysLimit} dias a partir da data de hoje.
                    </p>
                  </div>
                </div>
              )}
              <div className="mb-4 flex justify-between items-center">
                <div>
                  <span className="font-semibold">Valor total selecionado:</span> {formatCurrency(totalSelectedAmount)}
                </div>
                <div className="space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={selectAllReceivables}
                    disabled={receivables.length === 0 || receivables.length === selectedReceivables.length}
                  >
                    Selecionar Todos
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={deselectAllReceivables}
                    disabled={selectedReceivables.length === 0}
                  >
                    Limpar Seleção
                  </Button>
                </div>
              </div>
              
              {receivables.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium">Nenhum recebível disponível</h3>
                  <p className="text-gray-500 mt-2">
                    Não há recebíveis elegíveis para antecipação neste projeto.
                  </p>
                </div>
              ) : (
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="py-2 px-4 text-left w-12"></th>
                        <th className="py-2 px-4 text-left">Comprador</th>
                        <th className="py-2 px-4 text-left">CPF</th>
                        <th className="py-2 px-4 text-left">Vencimento</th>
                        <th className="py-2 px-4 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receivables.map((receivable) => {
                        const isWithinLimit = isReceivableWithinLimit(receivable);
                        return (
                          <tr 
                            key={receivable.id} 
                            className={`border-b hover:bg-gray-50 cursor-pointer ${
                              selectedReceivables.some(r => r.id === receivable.id) ? 'bg-primary/5' : ''
                            } ${!isWithinLimit ? 'opacity-50' : ''}`}
                            onClick={() => isWithinLimit && toggleReceivable(receivable)}
                          >
                            <td className="py-3 px-4">
                              <Checkbox 
                                checked={selectedReceivables.some(r => r.id === receivable.id)}
                                onCheckedChange={() => isWithinLimit && toggleReceivable(receivable)}
                                className="ml-1"
                                disabled={!isWithinLimit}
                              />
                            </td>
                            <td className="py-3 px-4 font-medium">{receivable.buyer_name || "—"}</td>
                            <td className="py-3 px-4">{formatCPF(receivable.buyer_cpf)}</td>
                            <td className="py-3 px-4">
                              {format(new Date(receivable.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                              {!isWithinLimit && (
                                <span className="ml-2 text-xs text-red-500">
                                  (Fora do prazo)
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">{formatCurrency(receivable.amount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </>
        )}
        
        {step === 2 && calculationResult && (
          <>
            <CardHeader>
              <CardTitle>Revisão dos valores</CardTitle>
              <CardDescription>
                Confirme os valores da sua solicitação de antecipação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-gray-500 mb-1">Quantidade de Recebíveis</div>
                    <div className="text-2xl font-semibold">{calculationResult.quantidade}</div>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-gray-500 mb-1">Valor Total dos Recebíveis</div>
                    <div className="text-2xl font-semibold">{formatCurrency(calculationResult.valorTotal)}</div>
                  </div>
                </div>
                
                <div className="bg-primary/5 p-6 rounded-lg border">
                  <div className="text-sm text-gray-500 mb-2">Valor Líquido (a receber)</div>
                  <div className="text-3xl font-bold text-primary">
                    {formatCurrency(calculationResult.valorLiquido)}
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium mb-3">Detalhamento das taxas aplicadas</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Taxa de juros até 180 dias:</span>
                      <span className="font-medium">{calculationResult.taxas.interest_rate_180}% a.m.</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Taxa de juros até 360 dias:</span>
                      <span className="font-medium">{calculationResult.taxas.interest_rate_360}% a.m.</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Taxa de juros até 720 dias:</span>
                      <span className="font-medium">{calculationResult.taxas.interest_rate_720}% a.m.</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Taxa de juros longo prazo:</span>
                      <span className="font-medium">{calculationResult.taxas.interest_rate_long_term}% a.m.</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tarifa por recebível:</span>
                      <span className="font-medium">{formatCurrency(calculationResult.taxas.fee_per_receivable)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </>
        )}
        
        {step === 3 && calculationResult && (
          <>
            <CardHeader>
              <CardTitle>Confirmar Antecipação</CardTitle>
              <CardDescription>
                Revise e confirme a solicitação de antecipação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="bg-gray-50 p-6 rounded-lg border">
                  <h3 className="font-medium text-lg mb-4">Resumo da Antecipação</h3>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Empresa:</span>
                      <span className="font-medium">{companyData?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Quantidade de recebíveis:</span>
                      <span className="font-medium">{calculationResult.quantidade}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Valor total dos recebíveis:</span>
                      <span className="font-medium">{formatCurrency(calculationResult.valorTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Valor líquido a receber:</span>
                      <span className="font-medium">{formatCurrency(calculationResult.valorLiquido)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-primary/5 p-6 rounded-lg border">
                  {
                    !recebiveisState.length ? (
                      <div className="flex items-center justify-center">
                        <Loader className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : (      
                      <AnticipationTerms
                        refComponent={reportTemplateRef}
                        projectId={projectId}
                        user={{
                          email: user?.email
                        }}
                        cedente={{
                          razaoSocial: companyData?.name,
                          cnpj: formatCNPJ(companyData?.cnpj),
                        }}
                        recebiveis={recebiveisState}
                        valores={{
                          // DATA DO DIA DA OPERAÇAO. SE ATE AS 14HRS, HOJE, SE DEPOIS, AMANHA
                          dataPagamento: format(new Date(), 'dd/MM/yyyy', { locale: ptBR }),
                          descontos: calculationResult?.taxas.fee_per_receivable,
                          formaPagamento: "A Vista",
                          precoPagoCessao: calculationResult?.valorLiquido,
                          valorLiquidoPagoAoCedente: calculationResult?.valorLiquido,
                          valorTotalCreditosVencimento: calculationResult?.valorTotal,
                        }}
                      />
                    )
                  }
                  <div className="my-6 bg-gray-300 h-[1px]"/>
                  <p className="text-sm text-gray-600 mb-4">
                    Ao clicar em "Confirmar Antecipação", você concorda com os seguintes termos:
                  </p>
                  <ul className="text-sm text-gray-600 space-y-2 list-disc pl-5">
                    <li>Esta é uma solicitação formal de antecipação de recebíveis que está sujeita à aprovação.</li>
                    <li>Os recebíveis selecionados ficarão bloqueados para outras operações enquanto esta solicitação estiver em análise.</li>
                    <li>O valor líquido a receber pode sofrer alterações caso a análise identifique alguma inconsistência nos recebíveis.</li>
                    <li>Após a aprovação, o valor líquido será creditado na conta bancária registrada em sua empresa.</li>
                  </ul>
                </div>
                
                <div className="flex items-center justify-center mt-4">
                  <CheckCircle className="text-primary h-6 w-6 mr-2" />
                  <span className="text-center">
                    Ao continuar, confirmo que li e concordo com os termos acima.
                  </span>
                </div>
              </div>
            </CardContent>
          </>
        )}
        
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={step === 1 ? () => navigate(`/project-dashboard/${projectId}`) : handleBack}
          >
            {step === 1 ? 'Cancelar' : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Voltar
              </>
            )}
          </Button>
          
          {step < 3 ? (
            <Button onClick={handleContinue} disabled={isLoading || selectedReceivables.length === 0}>
              {isLoading ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  Continuar
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          ) : (
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting}
              className="bg-primary"
            >
              {isSubmitting ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : 'Confirmar Antecipação'}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default CreateAnticipationForm;
