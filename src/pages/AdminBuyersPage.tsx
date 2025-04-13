import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { documentManagementApi, supabase } from "@/integrations/supabase/client";
import { formatCPF } from "@/lib/formatters";
import { useQuery } from "@tanstack/react-query";
import { FileText, Loader2, PenSquare, Users, FileCheck, CreditCard } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminBuyersPage() {
  const { session, userRole, isLoading: isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusType, setStatusType] = useState<'contract' | 'credit'>('contract');
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [filters, setFilters] = useState({
    name: '',
    cpf: '',
    company: '',
    project: '',
    status: 'all',
    contractStatus: 'all',
    creditAnalysisStatus: 'all'
  });

  useEffect(() => {
    if (!isLoadingAuth && (!session || userRole !== 'admin')) {
      navigate('/admin/auth');
    }
  }, [session, userRole, isLoadingAuth, navigate]);

  const { data: buyers, isLoading: isLoadingBuyers, error, refetch } = useQuery({
    queryKey: ['admin-buyers', filters],
    queryFn: async () => {
      try {
        if (!session?.access_token) {
          console.error('No access token available');
          throw new Error('Authentication required');
        }

        if (userRole !== 'admin') {
          console.error('User is not an admin');
          throw new Error('Admin access required');
        }

        console.log('Fetching buyers with session:', {
          hasAccessToken: !!session.access_token,
          userRole,
          userId: session.user.id
        });

        const { data, error } = await supabase.functions.invoke('admin-project-buyers', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: {
            action: 'list',
            filters: {
              fullName: filters.name,
              cpf: filters.cpf,
              companyName: filters.company,
              projectName: filters.project,
              buyerStatus: filters.status !== 'all' ? filters.status : undefined,
              contractStatus: filters.contractStatus !== 'all' ? filters.contractStatus : undefined,
              creditAnalysisStatus: filters.creditAnalysisStatus !== 'all' ? filters.creditAnalysisStatus : undefined
            }
          }
        });

        if (error) {
          console.error('Error fetching buyers:', error);
          throw error;
        }

        if (!data?.buyers) {
          console.error('Invalid response format:', data);
          throw new Error('Invalid response format');
        }

        console.log('Buyers data:', data);
        return data.buyers;
      } catch (error) {
        console.error('Error fetching buyers:', error);
        throw error;
      }
    },
    enabled: !!session?.access_token && userRole === 'admin' && !isLoadingAuth,
  });

  const getStatusDisplay = (status: string) => {
    const statusMap: Record<string, { label: string, className: string }> = {
      'aprovado': { label: 'Aprovado', className: 'text-green-600' },
      'reprovado': { label: 'Reprovado', className: 'text-red-600' },
      'a_analisar': { label: 'A Analisar', className: 'text-yellow-600' },
      'a_enviar': { label: 'A Enviar', className: 'text-blue-600' },
    };

    return statusMap[status] || { label: status, className: 'text-gray-500' };
  };

  const openStatusDialog = (buyerId: string, type: 'contract' | 'credit', currentStatus: string) => {
    setSelectedBuyerId(buyerId);
    setStatusType(type);
    setSelectedStatus(currentStatus);
    setStatusDialogOpen(true);
  };

  const handleStatusChange = async () => {
    if (!selectedBuyerId || !selectedStatus) return;

    try {
      const selectedBuyer = buyers?.find(buyer => buyer.id === selectedBuyerId);
      if (!selectedBuyer) {
        toast.error("Comprador não encontrado");
        return;
      }

      const updateData = statusType === 'contract' 
        ? { 
            contract_status: selectedStatus as 'aprovado' | 'reprovado' | 'a_enviar' | 'a_analisar',
            companyId: selectedBuyer.company_id,
            projectId: selectedBuyer.project_id
          }
        : { 
            credit_analysis_status: selectedStatus as 'aprovado' | 'reprovado' | 'a_analisar',
            companyId: selectedBuyer.company_id,
            projectId: selectedBuyer.project_id
          };

      const { data, error } = await supabase.functions.invoke('admin-project-buyers', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          action: 'update',
          buyerId:selectedBuyerId,
          buyerData: {
            contract_status: updateData.contract_status,
            credit_analysis_status: updateData.credit_analysis_status
          },
          companyId: updateData.companyId,
          projectId: updateData.projectId
        }
      });

      console.log('data', data);
      console.log('error', error);  
      
      toast.success("Status atualizado com sucesso");
      setStatusDialogOpen(false);
      refetch();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  const downloadContract = async (buyer: any) => {
    if (!buyer.contract_file_path || buyer.contract_file_path.trim() === '') {
      toast.error("Este comprador não possui contrato para download");
      return;
    }

    try {
      console.log('Attempting to download file from path:', buyer.contract_file_path);

      const { data, error } = await documentManagementApi.getDocumentSignedUrl(buyer.contract_file_path);
      if (error) {
        console.error('Error downloading contract:', error);
        throw error;
      }

      if(data.signedUrl){
        const response = await fetch(data.signedUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = buyer.contract_file_path.split('/').pop();
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);

      }


      toast.success("Download do contrato iniciado");
    } catch (error) {
      console.error('Error downloading contract:', error);
      
      const errorMessage = error instanceof Error ? error.message : "Erro ao baixar o contrato";
      const isFileNotFound = errorMessage.includes("not found") || errorMessage.includes("does not exist");
      
      toast.error(isFileNotFound 
        ? "Contrato não encontrado. O arquivo pode ter sido removido."
        : errorMessage);
    }
  };

  if (isLoadingAuth) {
    return (
      <>
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          <span className="ml-2 text-gray-500">Verificando autenticação...</span>
        </div>
      </>
    );
  }

  if (!session || userRole !== 'admin') {
    return null;
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Compradores</h1>
      </div>

      {/* Status Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Total de Compradores</h3>
          <p className="text-2xl font-bold mt-2">{buyers?.length || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Status do Comprador</h3>
          <div className="space-y-2 mt-2">
            <div className="flex justify-between items-center">
              <Badge variant="outline" className="bg-green-100 text-green-800">Aprovados</Badge>
              <span className="font-medium">
                {buyers?.filter(b => b.buyer_status === 'aprovado').length || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <Badge variant="outline" className="bg-red-100 text-red-800">Reprovados</Badge>
              <span className="font-medium">
                {buyers?.filter(b => b.buyer_status === 'reprovado').length || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Em Análise</Badge>
              <span className="font-medium">
                {buyers?.filter(b => b.buyer_status === 'a_analisar').length || 0}
              </span>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Status do Contrato</h3>
          <div className="space-y-2 mt-2">
            <div className="flex justify-between items-center">
              <Badge variant="outline" className="bg-green-100 text-green-800">Aprovados</Badge>
              <span className="font-medium">
                {buyers?.filter(b => b.contract_status === 'aprovado').length || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <Badge variant="outline" className="bg-red-100 text-red-800">Reprovados</Badge>
              <span className="font-medium">
                {buyers?.filter(b => b.contract_status === 'reprovado').length || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <Badge variant="outline" className="bg-blue-100 text-blue-800">A Enviar</Badge>
              <span className="font-medium">
                {buyers?.filter(b => b.contract_status === 'a_enviar').length || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Em Análise</Badge>
              <span className="font-medium">
                {buyers?.filter(b => b.contract_status === 'a_analisar').length || 0}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Filters Section */}
      <div className="bg-white p-4 rounded-lg border shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label htmlFor="name">Nome do Comprador</Label>
            <Input
              id="name"
              placeholder="Buscar por nome..."
              value={filters.name}
              onChange={(e) => setFilters(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              placeholder="Buscar por CPF..."
              value={filters.cpf}
              onChange={(e) => setFilters(prev => ({ ...prev, cpf: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="company">Empresa</Label>
            <Input
              id="company"
              placeholder="Buscar por empresa..."
              value={filters.company}
              onChange={(e) => setFilters(prev => ({ ...prev, company: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="project">Projeto</Label>
            <Input
              id="project"
              placeholder="Buscar por projeto..."
              value={filters.project}
              onChange={(e) => setFilters(prev => ({ ...prev, project: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="status">Status do Comprador</Label>
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="reprovado">Reprovado</SelectItem>
                <SelectItem value="a_analisar">Em Análise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="contractStatus">Status do Contrato</Label>
            <Select
              value={filters.contractStatus}
              onValueChange={(value) => setFilters(prev => ({ ...prev, contractStatus: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
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
          <div className="space-y-1">
            <Label htmlFor="creditAnalysisStatus">Status da Análise de Crédito</Label>
            <Select
              value={filters.creditAnalysisStatus}
              onValueChange={(value) => setFilters(prev => ({ ...prev, creditAnalysisStatus: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
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
      </div>

      {/* Table Section */}
      <Card>
        <CardContent className="p-0">
          {isLoadingBuyers ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              {buyers && buyers.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Projeto</TableHead>
                      <TableHead>Status Comprador</TableHead>
                      <TableHead>Status Contrato</TableHead>
                      <TableHead>Status Análise</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {buyers.map((buyer) => {
                      const buyerStatus = getStatusDisplay(buyer.buyer_status);
                      const contractStatus = getStatusDisplay(buyer.contract_status);
                      const creditStatus = getStatusDisplay(buyer.credit_analysis_status);

                      return (
                        <TableRow key={buyer.id}>
                          <TableCell>{buyer.full_name}</TableCell>
                          <TableCell>{formatCPF(buyer.cpf)}</TableCell>
                          <TableCell>{buyer.company_name}</TableCell>
                          <TableCell>{buyer.project_name}</TableCell>
                          <TableCell className={buyerStatus.className}>
                            {buyerStatus.label}
                          </TableCell>
                          <TableCell className={contractStatus.className}>
                            {contractStatus.label}
                          </TableCell>
                          <TableCell className={creditStatus.className}>
                            {creditStatus.label}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => openStatusDialog(buyer.id, 'contract', buyer.contract_status)}
                                title="Alterar status do contrato"
                              >
                                <PenSquare className="h-4 w-4 mr-1" />
                                Contrato
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => openStatusDialog(buyer.id, 'credit', buyer.credit_analysis_status)}
                                title="Alterar status da análise de crédito"
                              >
                                <PenSquare className="h-4 w-4 mr-1" />
                                Crédito
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => downloadContract(buyer)}
                                disabled={!buyer.contract_file_path || buyer.contract_file_path.trim() === ''}
                                title={buyer.contract_file_path && buyer.contract_file_path.trim() !== '' ? "Baixar contrato" : "Sem contrato disponível"}
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                Contrato
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-10 text-gray-500">
                  Nenhum comprador encontrado.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {statusType === 'contract' ? 'Alterar Status do Contrato' : 'Alterar Status da Análise de Crédito'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="font-medium">Selecione o novo status:</div>
              <div className="grid grid-cols-1 gap-2">
                {statusType === 'contract' ? (
                  <>
                    <Button 
                      variant={selectedStatus === 'a_enviar' ? 'default' : 'outline'}
                      onClick={() => setSelectedStatus('a_enviar')}
                    >
                      A Enviar
                    </Button>
                    <Button 
                      variant={selectedStatus === 'a_analisar' ? 'default' : 'outline'}
                      onClick={() => setSelectedStatus('a_analisar')}
                    >
                      A Analisar
                    </Button>
                    <Button 
                      variant={selectedStatus === 'aprovado' ? 'success' : 'outline'}
                      onClick={() => setSelectedStatus('aprovado')}
                    >
                      Aprovar
                    </Button>
                    <Button 
                      variant={selectedStatus === 'reprovado' ? 'destructive' : 'outline'}
                      onClick={() => setSelectedStatus('reprovado')}
                    >
                      Reprovar
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      variant={selectedStatus === 'a_analisar' ? 'default' : 'outline'}
                      onClick={() => setSelectedStatus('a_analisar')}
                    >
                      A Analisar
                    </Button>
                    <Button 
                      variant={selectedStatus === 'aprovado' ? 'success' : 'outline'}
                      onClick={() => setSelectedStatus('aprovado')}
                    >
                      Aprovar
                    </Button>
                    <Button 
                      variant={selectedStatus === 'reprovado' ? 'destructive' : 'outline'}
                      onClick={() => setSelectedStatus('reprovado')}
                    >
                      Reprovar
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleStatusChange}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
