import AnticipationsList from "@/components/anticipations/AnticipationsList";
import { BoletosTable } from "@/components/boletos/BoletosTable";
import { EditBoletoDialog } from "@/components/boletos/EditBoletoDialog";
import { ViewBoletoDialog } from "@/components/boletos/ViewBoletoDialog";
import PaymentPlansTable from "@/components/payment-plans/PaymentPlansTable";
import { ReceivableBulkImportDialog } from "@/components/receivables/ReceivableBulkImportDialog";
import { ReceivableDialog } from "@/components/receivables/ReceivableDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useProjectBoletos } from "@/hooks/useProjectBoletos";
import { useProjectPaymentPlans } from "@/hooks/useProjectPaymentPlans";
import { supabase } from "@/integrations/supabase/client";
import { formatCNPJ, formatCompactCurrency, formatCPF, formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDownToLine, Banknote, FileSpreadsheet, FileText, Loader, PencilIcon, Plus, Receipt, Upload, UsersRound, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BankAccountTab } from "@/components/project/BankAccountTab";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Project {
  id: string;
  name: string;
  cnpj: string;
  initial_date: string;
  end_date: string | null;
  status: 'active' | 'inactive';
  companies: {
    name: string;
  };
}

interface ProjectBuyer {
  id: string;
  full_name: string;
  cpf: string;
  buyer_status: 'aprovado' | 'reprovado' | 'a_analisar';
  contract_status: 'aprovado' | 'reprovado' | 'a_enviar' | 'a_analisar';
  credit_analysis_status: 'aprovado' | 'reprovado' | 'a_analisar';
  created_at: string;
  updated_at: string;
  contract_file_path?: string;
  contract_file_name?: string;
}

interface Receivable {
  id: string;
  project_id: string;
  buyer_name?: string;
  buyer_cpf: string;
  amount: number;
  due_date: string;
  description?: string;
  status: 'enviado' | 'elegivel_para_antecipacao' | 'reprovado' | 'antecipado';
  created_at: string;
  updated_at: string;
  projects?: {
    name: string;
  };
}

interface Anticipation {
  id: string;
  project_id: string;
  valor_total: number;
  valor_liquido: number;
  status: string;
  quantidade_recebiveis: number;
  created_at: string;
  updated_at: string;
  projects?: {
    name: string;
  };
}

interface DashboardSummary {
  totalBuyers: number;
  totalReceivablesAmount: number;
  totalAnticipationsAmount: number;
  totalInvoices: number;
}

const ProjectDashboardPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("compradores");
  const [projectBuyers, setProjectBuyers] = useState<ProjectBuyer[]>([]);
  const [filteredBuyers, setFilteredBuyers] = useState<ProjectBuyer[]>([]);
  const [buyerFilters, setBuyerFilters] = useState({
    name: '',
    cpf: '',
    status: 'all',
    contractStatus: 'all',
    creditStatus: 'all'
  });
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [filteredReceivables, setFilteredReceivables] = useState<Receivable[]>([]);
  const [receivableFilters, setReceivableFilters] = useState({
    buyerName: '',
    buyerCpf: '',
    status: 'all',
    dueDateStart: '',
    dueDateEnd: ''
  });
  const [isLoadingBuyers, setIsLoadingBuyers] = useState(false);
  const [isLoadingReceivables, setIsLoadingReceivables] = useState(false);
  const [receivableDialogOpen, setReceivableDialogOpen] = useState(false);
  const [bulkImportDialogOpen, setBulkImportDialogOpen] = useState(false);
  const [anticipations, setAnticipations] = useState<Anticipation[]>([]);
  const [isLoadingAnticipations, setIsLoadingAnticipations] = useState(false);
  const { session } = useAuth();
  const { toast } = useToast();
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedInitialDate, setEditedInitialDate] = useState("");
  const [editedEndDate, setEditedEndDate] = useState("");
  const [editedStatus, setEditedStatus] = useState<'active' | 'inactive'>('active');
  const [isSaving, setIsSaving] = useState(false);
  
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [selectedBuyer, setSelectedBuyer] = useState<ProjectBuyer | null>(null);
  const [isUploadingContract, setIsUploadingContract] = useState(false);
  
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary>({
    totalBuyers: 0,
    totalReceivablesAmount: 0,
    totalAnticipationsAmount: 0,
    totalInvoices: 0
  });

  const { boletos, totalBoletos, isLoading: isLoadingBoletos, filters: boletoFilters, handleFilterChange: handleBoletoFilterChange, refreshBoletos } = 
    useProjectBoletos(projectId || "");
  const [selectedBoleto, setSelectedBoleto] = useState<any>(null);
  const [editBoletoDialogOpen, setEditBoletoDialogOpen] = useState(false);
  
  const { 
    paymentPlans, 
    selectedPlan, 
    isLoading: isLoadingPaymentPlans, 
    fetchPlanDetails 
  } = useProjectPaymentPlans(projectId || "");

  useEffect(() => {
    const fetchProjectDetails = async () => {
      if (!projectId || !session?.access_token) return;

      try {
        setIsLoading(true);
        
        const { data, error } = await supabase.functions.invoke('project-management', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: {
            method: 'GET',
            endpoint: `projects/${projectId}`
          }
        });
        
        if (error) {
          console.error('Error fetching project details:', error);
          return;
        }
        
        console.log('Project details:', data);
        setProject(data.project || null);
        
        if (data.project) {
          setEditedName(data.project.name);
          setEditedInitialDate(data.project.initial_date);
          setEditedEndDate(data.project.end_date || "");
          setEditedStatus(data.project.status);
        }
      } catch (error) {
        console.error('Error fetching project details:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProjectDetails();
  }, [projectId, session]);

  useEffect(() => {
    if (projectId && session?.access_token) {
      fetchProjectBuyers();
      fetchProjectReceivables();
      fetchProjectAnticipations();
    }
  }, [projectId, session]);

  useEffect(() => {
    updateDashboardSummary();
  }, [projectBuyers, receivables, anticipations, boletos]);

  useEffect(() => {
    // Apply filters to project buyers
    let filtered = [...projectBuyers];
    
    if (buyerFilters.name) {
      filtered = filtered.filter(buyer => 
        buyer.full_name.toLowerCase().includes(buyerFilters.name.toLowerCase())
      );
    }
    
    if (buyerFilters.cpf) {
      filtered = filtered.filter(buyer => 
        buyer.cpf.replace(/\D/g, '').includes(buyerFilters.cpf.replace(/\D/g, ''))
      );
    }
    
    if (buyerFilters.status !== 'all') {
      filtered = filtered.filter(buyer => buyer.buyer_status === buyerFilters.status);
    }
    
    if (buyerFilters.contractStatus !== 'all') {
      filtered = filtered.filter(buyer => buyer.contract_status === buyerFilters.contractStatus);
    }
    
    if (buyerFilters.creditStatus !== 'all') {
      filtered = filtered.filter(buyer => buyer.credit_analysis_status === buyerFilters.creditStatus);
    }
    
    setFilteredBuyers(filtered);
  }, [projectBuyers, buyerFilters]);

  useEffect(() => {
    // Apply filters to receivables
    let filtered = [...receivables];
    
    if (receivableFilters.buyerName) {
      filtered = filtered.filter(receivable => 
        receivable.buyer_name?.toLowerCase().includes(receivableFilters.buyerName.toLowerCase())
      );
    }
    
    if (receivableFilters.buyerCpf) {
      filtered = filtered.filter(receivable => 
        receivable.buyer_cpf.replace(/\D/g, '').includes(receivableFilters.buyerCpf.replace(/\D/g, ''))
      );
    }
    
    if (receivableFilters.status !== 'all') {
      filtered = filtered.filter(receivable => receivable.status === receivableFilters.status);
    }
    
    if (receivableFilters.dueDateStart) {
      filtered = filtered.filter(receivable => 
        new Date(receivable.due_date) >= new Date(receivableFilters.dueDateStart)
      );
    }
    
    if (receivableFilters.dueDateEnd) {
      filtered = filtered.filter(receivable => 
        new Date(receivable.due_date) <= new Date(receivableFilters.dueDateEnd)
      );
    }
    
    setFilteredReceivables(filtered);
  }, [receivables, receivableFilters]);

  const updateDashboardSummary = () => {
    setDashboardSummary({
      totalBuyers: projectBuyers.length,
      totalReceivablesAmount: receivables.reduce((sum, r) => sum + Number(r.amount), 0),
      totalAnticipationsAmount: anticipations.reduce((sum, a) => sum + Number(a.valor_total), 0),
      totalInvoices: totalBoletos
    });
  };

  const fetchProjectBuyers = async () => {
    if (!projectId || !session?.access_token) return;

    try {
      setIsLoadingBuyers(true);
      
      const { data, error } = await supabase.functions.invoke('project-buyers', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          action: 'list',
          projectId: projectId
        }
      });
      
      if (error) {
        console.error('Error fetching project buyers:', error);
        toast({
          title: "Erro ao carregar compradores",
          description: "Não foi possível obter a lista de compradores deste projeto.",
          variant: "destructive"
        });
        return;
      }
      
      console.log('Project buyers:', data);
      setProjectBuyers(data?.buyers || []);
    } catch (error) {
      console.error('Error fetching project buyers:', error);
      toast({
        title: "Erro ao carregar compradores",
        description: "Ocorreu um erro ao buscar os compradores.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingBuyers(false);
    }
  };

  const fetchProjectReceivables = async () => {
    if (!projectId || !session?.access_token) return;

    try {
      setIsLoadingReceivables(true);
      
      console.log('Fetching receivables for project:', projectId);
      const receivablesData = await supabase.functions.invoke('project-receivables', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          method: 'GET',
          endpoint: 'receivables',
          projectId: projectId
        }
      });
      console.log('Project receivables:', receivablesData);
      setReceivables(receivablesData?.data?.receivables || []);
    } catch (error) {
      console.error('Error fetching receivables:', error);
      toast({
        title: "Erro ao carregar recebíveis",
        description: "Não foi possível obter a lista de recebíveis deste projeto.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingReceivables(false);
    }
  };
  
  const fetchProjectAnticipations = async () => {
    if (!projectId || !session?.access_token) return;
    
    try {
      setIsLoadingAnticipations(true);
      
      const { data: projectData } = await supabase.functions.invoke('project-management', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          method: 'GET',
          endpoint: `projects/${projectId}`
        }
      });
      
      if (!projectData || !projectData.project) {
        throw new Error('Project not found');
      }
      
      const companyId = projectData.project.company_id;
      
      const { data: anticipationsData, error: anticipationsError } = await supabase
        .rpc('get_project_anticipations', {
          p_company_id: companyId,
          p_project_id: projectId
        });
      
      if (anticipationsError) {
        console.error('Error fetching anticipations:', anticipationsError);
        throw anticipationsError;
      }
      
      if (Array.isArray(anticipationsData)) {
        setAnticipations(anticipationsData as unknown as Anticipation[]);
      } else {
        setAnticipations([]);
      }
    } catch (error) {
      console.error('Error fetching anticipations:', error);
    } finally {
      setIsLoadingAnticipations(false);
    }
  };

  const handleReceivableCreated = () => {
    fetchProjectReceivables();
  };

  const handleSaveProject = async () => {
    if (!projectId || !session?.access_token) return;
    
    try {
      setIsSaving(true);
      
      const { data, error } = await supabase.functions.invoke('project-management', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          method: 'PUT',
          endpoint: `${projectId}`,
          name: editedName,
          initial_date: editedInitialDate,
          end_date: editedEndDate || null,
          status: editedStatus
        }
      });
      
      if (error) {
        console.error('Error updating project:', error);
        toast({
          title: "Erro ao atualizar projeto",
          description: "Não foi possível salvar as alterações.",
          variant: "destructive"
        });
        return;
      }
      
      setProject(data.project);
      toast({
        title: "Projeto atualizado",
        description: "As alterações foram salvas com sucesso.",
        variant: "default"
      });
      
      setEditDialogOpen(false);
    } catch (error) {
      console.error('Error updating project:', error);
      toast({
        title: "Erro ao atualizar projeto",
        description: "Não foi possível salvar as alterações.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getBuyerStatusBadge = (status: string) => {
    switch (status) {
      case 'aprovado':
        return <Badge variant="success">Aprovado</Badge>;
      case 'reprovado':
        return <Badge variant="destructive">Reprovado</Badge>;
      case 'a_analisar':
        return <Badge variant="warning">Em Análise</Badge>;
      default:
        return <Badge variant="secondary">A Enviar</Badge>;
    }
  };

  const getReceivableStatusBadge = (status: string) => {
    switch (status) {
      case 'elegivel_para_antecipacao':
        return <Badge variant="success">Elegível para Antecipação</Badge>;
      case 'reprovado':
        return <Badge variant="destructive">Reprovado</Badge>;
      case 'antecipado':
        return <Badge variant="default" className="bg-blue-500">Antecipado</Badge>;
      default:
        return <Badge variant="secondary">Enviado</Badge>;
    }
  };

  const handleContractClick = (buyer: ProjectBuyer) => {
    if (buyer.contract_status === 'a_enviar') {
      setSelectedBuyer(buyer);
      setContractDialogOpen(true);
    }
  };

  const handleContractUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files[0] || !projectId || !selectedBuyer) {
      return;
    }

    const file = event.target.files[0];
    
    try {
      setIsUploadingContract(true);
      
      const reader = new FileReader();
      
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('Failed to convert file to base64'));
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      
      console.log("Uploading contract for buyer:", selectedBuyer.id);
      
      const uploadResponse = await supabase.functions.invoke('document-management', {
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        },
        body: {
          action: 'uploadFile',
          file: fileBase64,
          fileName: file.name,
          resourceType: 'projects',
          resourceId: projectId,
          buyerId: selectedBuyer.id
        }
      });
      
      if (uploadResponse.error) {
        console.error('Error uploading contract:', uploadResponse.error);
        throw new Error(uploadResponse.error.message || 'Upload failed');
      }
      
      console.log('File uploaded successfully:', uploadResponse.data);
      
      // Refresh the buyers list to see the updated status
      await fetchProjectBuyers();
      
      toast({
        title: "Contrato enviado",
        description: "O contrato foi enviado e está em análise.",
      });
      
      setContractDialogOpen(false);
    } catch (error) {
      console.error('Error in contract upload process:', error);
      toast({
        title: "Erro ao enviar contrato",
        description: "Não foi possível enviar o contrato. " + (error.message || ''),
        variant: "destructive"
      });
    } finally {
      setIsUploadingContract(false);
    }
  };

  const downloadContract = async () => {
    if (!selectedBuyer?.contract_file_path) {
      toast({
        title: "Nenhum contrato disponível",
        description: "Este comprador ainda não possui um contrato para download.",
        variant: "default",
      });
      return;
    }
    
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(selectedBuyer.contract_file_path);
      
      if (error) {
        console.error('Error downloading contract:', error);
        throw error;
      }
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = selectedBuyer.contract_file_name || 'contrato.pdf';
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading contract:', error);
      toast({
        title: "Erro ao baixar contrato",
        description: "Não foi possível baixar o contrato.",
        variant: "destructive"
      });
    }
  };

  const handleEditBoleto = (boleto: any) => {
    setSelectedBoleto(boleto);
    setEditBoletoDialogOpen(true);
  };

  if (isLoading) {
    return (
      <>
        <div className="flex justify-center items-center h-[calc(100vh-120px)]">
          <Loader className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      </>
    );
  }

  if (!project) {
    return (
      <>
        <div className="text-center py-10">
          <h2 className="text-2xl font-bold text-gray-900">Projeto não encontrado</h2>
          <p className="mt-2 text-gray-500">O projeto solicitado não existe ou você não tem permissão para acessá-lo.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="p-6">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{project.name}</h1>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>ID do Projeto: {project.id}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Badge variant={project.status === 'active' ? 'success' : 'secondary'}>
                {project.status === 'active' ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
              <div>CNPJ: {formatCNPJ(project.cnpj)}</div>
              <div>Início: {format(new Date(project.initial_date), 'dd/MM/yyyy', { locale: ptBR })}</div>
              {project.end_date && (
                <div>Término: {format(new Date(project.end_date), 'dd/MM/yyyy', { locale: ptBR })}</div>
              )}
            </div>
          </div>
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={() => setEditDialogOpen(true)}
          >
            <PencilIcon className="h-4 w-4" />
            Editar Projeto
          </Button>
        </div>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Editar Projeto</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Projeto</Label>
                <Input
                  id="name"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="initialDate">Data de Início</Label>
                <Input
                  id="initialDate"
                  type="date"
                  value={editedInitialDate}
                  onChange={(e) => setEditedInitialDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Data de Término</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={editedEndDate}
                  onChange={(e) => setEditedEndDate(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between space-y-0 pt-2">
                <Label htmlFor="status">Status do Projeto</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="status"
                    checked={editedStatus === 'active'}
                    onCheckedChange={(checked) => setEditedStatus(checked ? 'active' : 'inactive')}
                  />
                  <span className="text-sm text-gray-500">
                    {editedStatus === 'active' ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveProject} disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar alterações"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total de Compradores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardSummary.totalBuyers}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Recebíveis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold truncate">
                {formatCompactCurrency(dashboardSummary.totalReceivablesAmount)}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Antecipações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold truncate">
                {formatCompactCurrency(dashboardSummary.totalAnticipationsAmount)}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Boletos Emitidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardSummary.totalInvoices}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="compradores" className="w-full" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 bg-white">
            <TabsTrigger value="compradores" className="flex items-center gap-2">
              <UsersRound className="h-4 w-4" />
              Compradores
            </TabsTrigger>
            <TabsTrigger value="recebiveis" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Recebíveis
            </TabsTrigger>
            <TabsTrigger value="antecipacoes" className="flex items-center gap-2">
              <ArrowDownToLine className="h-4 w-4" />
              Antecipações
            </TabsTrigger>
            <TabsTrigger value="boletos" className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Boletos
            </TabsTrigger>
            <TabsTrigger value="plano-pagamento" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Plano de Pagamento
            </TabsTrigger>
            <TabsTrigger value="conta-bancaria" className="flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              Conta Bancária
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="compradores" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Compradores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="buyerName">Nome</Label>
                      <Input
                        id="buyerName"
                        placeholder="Buscar por nome..."
                        value={buyerFilters.name}
                        onChange={(e) => {
                          setBuyerFilters(prev => ({
                            ...prev,
                            name: e.target.value
                          }));
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="buyerCpf">CPF</Label>
                      <Input
                        id="buyerCpf"
                        placeholder="Buscar por CPF..."
                        value={buyerFilters.cpf}
                        onChange={(e) => {
                          setBuyerFilters(prev => ({
                            ...prev,
                            cpf: e.target.value
                          }));
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="buyerStatus">Status</Label>
                      <Select 
                        value={buyerFilters.status}
                        onValueChange={(value) => {
                          setBuyerFilters(prev => ({
                            ...prev,
                            status: value
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="aprovado">Aprovado</SelectItem>
                          <SelectItem value="reprovado">Reprovado</SelectItem>
                          <SelectItem value="a_analisar">Em Análise</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contractStatus">Contrato</Label>
                      <Select 
                        value={buyerFilters.contractStatus}
                        onValueChange={(value) => {
                          setBuyerFilters(prev => ({
                            ...prev,
                            contractStatus: value
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="aprovado">Aprovado</SelectItem>
                          <SelectItem value="reprovado">Reprovado</SelectItem>
                          <SelectItem value="a_enviar">A Enviar</SelectItem>
                          <SelectItem value="a_analisar">Em Análise</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="creditStatus">Crédito</Label>
                      <Select 
                        value={buyerFilters.creditStatus}
                        onValueChange={(value) => {
                          setBuyerFilters(prev => ({
                            ...prev,
                            creditStatus: value
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="aprovado">Aprovado</SelectItem>
                          <SelectItem value="reprovado">Reprovado</SelectItem>
                          <SelectItem value="a_analisar">Em Análise</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="border-t pt-6">
                    {isLoadingBuyers ? (
                      <div className="flex justify-center py-8">
                        <Loader className="h-6 w-6 animate-spin text-gray-500" />
                      </div>
                    ) : projectBuyers.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>CPF</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Contrato</TableHead>
                            <TableHead>Análise de Crédito</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredBuyers.map((buyer) => (
                            <TableRow key={buyer.id}>
                              <TableCell className="font-medium">{buyer.full_name}</TableCell>
                              <TableCell>{formatCPF(buyer.cpf)}</TableCell>
                              <TableCell>{getBuyerStatusBadge(buyer.buyer_status)}</TableCell>
                              <TableCell>{getBuyerStatusBadge(buyer.contract_status)}</TableCell>
                              <TableCell>{getBuyerStatusBadge(buyer.credit_analysis_status)}</TableCell>
                              <TableCell>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleContractClick(buyer)}
                                  className="flex items-center gap-2"
                                  disabled={buyer.contract_status !== 'a_enviar'}
                                  title={buyer.contract_status !== 'a_enviar' ? 
                                    "Não é possível modificar o contrato no status atual" : 
                                    "Enviar contrato"}
                                >
                                  <Upload className="h-4 w-4" />
                                  Contrato
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center text-gray-500 py-8">
                        Nenhum comprador cadastrado para este projeto ainda.
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="recebiveis" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recebíveis</CardTitle>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setBulkImportDialogOpen(true)} 
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Importar Excel
                  </Button>
                  <Button onClick={() => setReceivableDialogOpen(true)} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Adicionar Recebível
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="receivableBuyerName">Nome</Label>
                      <Input
                        id="receivableBuyerName"
                        placeholder="Buscar por nome..."
                        value={receivableFilters.buyerName}
                        onChange={(e) => {
                          setReceivableFilters(prev => ({
                            ...prev,
                            buyerName: e.target.value
                          }));
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="receivableBuyerCpf">CPF</Label>
                      <Input
                        id="receivableBuyerCpf"
                        placeholder="Buscar por CPF..."
                        value={receivableFilters.buyerCpf}
                        onChange={(e) => {
                          setReceivableFilters(prev => ({
                            ...prev,
                            buyerCpf: e.target.value
                          }));
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="receivableStatus">Status</Label>
                      <Select 
                        value={receivableFilters.status}
                        onValueChange={(value) => {
                          setReceivableFilters(prev => ({
                            ...prev,
                            status: value
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="enviado">Enviado</SelectItem>
                          <SelectItem value="elegivel_para_antecipacao">Elegível para Antecipação</SelectItem>
                          <SelectItem value="reprovado">Reprovado</SelectItem>
                          <SelectItem value="antecipado">Antecipado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dueDateStart">Vencimento Inicial</Label>
                      <Input
                        id="dueDateStart"
                        type="date"
                        value={receivableFilters.dueDateStart}
                        onChange={(e) => {
                          setReceivableFilters(prev => ({
                            ...prev,
                            dueDateStart: e.target.value
                          }));
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dueDateEnd">Vencimento Final</Label>
                      <Input
                        id="dueDateEnd"
                        type="date"
                        value={receivableFilters.dueDateEnd}
                        onChange={(e) => {
                          setReceivableFilters(prev => ({
                            ...prev,
                            dueDateEnd: e.target.value
                          }));
                        }}
                      />
                    </div>
                  </div>
                  <div className="border-t pt-6">
                    {isLoadingReceivables ? (
                      <div className="flex justify-center py-8">
                        <Loader className="h-6 w-6 animate-spin text-gray-500" />
                      </div>
                    ) : receivables.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome do Comprador</TableHead>
                            <TableHead>CPF do Comprador</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Data de Vencimento</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Descrição</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredReceivables.map((receivable) => (
                            <TableRow key={receivable.id}>
                              <TableCell className="font-medium">{receivable.buyer_name || "—"}</TableCell>
                              <TableCell>{formatCPF(receivable.buyer_cpf)}</TableCell>
                              <TableCell>{formatCurrency(receivable.amount)}</TableCell>
                              <TableCell>
                                {format(new Date(receivable.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                              </TableCell>
                              <TableCell>{getReceivableStatusBadge(receivable.status)}</TableCell>
                              <TableCell className="max-w-xs truncate">
                                {receivable.description || "-"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center text-gray-500 py-8">
                        Nenhum recebível cadastrado para este projeto ainda.
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="antecipacoes" className="mt-6">
            <AnticipationsList projectId={projectId || ""} />
          </TabsContent>
          
          <TabsContent value="boletos" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Boletos</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingBoletos ? (
                  <div className="flex justify-center py-8">
                    <Loader className="h-6 w-6 animate-spin text-gray-500" />
                  </div>
                ) : (
                  <BoletosTable
                    boletos={boletos}
                    isLoading={isLoadingBoletos}
                    onUpdate={handleEditBoleto}
                    onFilterChange={handleBoletoFilterChange}
                    filters={{...boletoFilters, projectId}}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="plano-pagamento" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Plano de Pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingPaymentPlans ? (
                  <div className="flex justify-center py-8">
                    <Loader className="h-6 w-6 animate-spin text-gray-500" />
                  </div>
                ) : (
                  <PaymentPlansTable
                    paymentPlans={paymentPlans}
                    selectedPlan={selectedPlan}
                    isLoading={isLoadingPaymentPlans}
                    onSelectPlan={fetchPlanDetails}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="conta-bancaria" className="mt-6">
            <BankAccountTab projectId={projectId || ""} />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={contractDialogOpen} onOpenChange={setContractDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Gerenciar Contrato</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {selectedBuyer && (
              <>
                <div className="space-y-2">
                  <p><strong>Comprador:</strong> {selectedBuyer.full_name}</p>
                  <p><strong>CPF:</strong> {formatCPF(selectedBuyer.cpf)}</p>
                  <p><strong>Status do contrato:</strong> {getBuyerStatusBadge(selectedBuyer.contract_status)}</p>
                </div>
                
                {selectedBuyer.contract_file_path ? (
                  <div className="space-y-4">
                    <p>
                      <strong>Contrato atual:</strong> {selectedBuyer.contract_file_name}
                    </p>
                    <Button onClick={downloadContract} className="w-full">
                      Baixar Contrato
                    </Button>
                    <div className="space-y-2">
                      <Label htmlFor="newContract">Substituir contrato</Label>
                      <Input
                        id="newContract"
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={handleContractUpload}
                        disabled={isUploadingContract}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="contract">Enviar contrato</Label>
                    <Input
                      id="contract"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleContractUpload}
                      disabled={isUploadingContract}
                    />
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContractDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReceivableDialog
        open={receivableDialogOpen}
        onOpenChange={setReceivableDialogOpen}
        projectId={projectId || ""}
        onReceivableCreated={handleReceivableCreated}
      />

      <ReceivableBulkImportDialog
        open={bulkImportDialogOpen}
        onOpenChange={setBulkImportDialogOpen}
        projectId={projectId || ""}
        onReceivablesImported={handleReceivableCreated}
      />

      {selectedBoleto && (
        session?.user?.app_metadata?.role === 'admin' ? (
          <EditBoletoDialog
            boleto={selectedBoleto}
            open={editBoletoDialogOpen}
            onClose={() => {
              setEditBoletoDialogOpen(false);
              setSelectedBoleto(null);
            }}
            onSuccess={refreshBoletos}
          />
        ) : (
          <ViewBoletoDialog
            boleto={selectedBoleto}
            open={editBoletoDialogOpen}
            onClose={() => {
              setEditBoletoDialogOpen(false);
              setSelectedBoleto(null);
            }}
          />
        )
      )}
    </>
  );
};

export default ProjectDashboardPage;
