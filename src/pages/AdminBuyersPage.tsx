import { useQuery } from "@tanstack/react-query";
import { projectBuyersApi } from "@/integrations/supabase/client";
import { AdminDashboardLayout } from "@/components/dashboard/AdminDashboardLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, FileText, PenSquare } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCPF } from "@/lib/formatters";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminBuyersTable } from "@/components/admin/AdminBuyersTable";

export default function AdminBuyersPage() {
  const { session, userRole, isLoading: isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusType, setStatusType] = useState<'contract' | 'credit'>('contract');
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Protect the route
  useEffect(() => {
    if (!isLoadingAuth && (!session || userRole !== 'admin')) {
      navigate('/admin/auth');
    }
  }, [session, userRole, isLoadingAuth, navigate]);

  const { data: buyers, isLoading: isLoadingBuyers, error, refetch } = useQuery({
    queryKey: ['admin-buyers'],
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

        // Make the API call directly with the session token
        const { data, error } = await supabase.functions.invoke('admin-project-buyers', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: {
            action: 'list'
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
      // Find the selected buyer to get company and project IDs
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

      // await projectBuyersApi.admin.updateBuyer(selectedBuyerId, updateData);
      
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
      refetch(); // Refresh the buyers list
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
      const { data, error } = await supabase.storage
        .from('documents')
        .download(buyer.contract_file_path);

      if (error) {
        console.error('Error downloading contract:', error);
        throw error;
      }

      // Create a download link
      const blob = new Blob([data], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buyer.contract_file_name || 'contrato.pdf';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      toast.success("Download do contrato iniciado");
    } catch (error) {
      console.error('Error downloading contract:', error);
      toast.error("Erro ao baixar o contrato");
    }
  };

  // Show loading state while checking authentication
  if (isLoadingAuth) {
    return (
      <AdminDashboardLayout>
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          <span className="ml-2 text-gray-500">Verificando autenticação...</span>
        </div>
      </AdminDashboardLayout>
    );
  }

  // If not authenticated or not admin, the useEffect will handle redirection
  if (!session || userRole !== 'admin') {
    return null;
  }

  return (
    <AdminDashboardLayout>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight">Compradores</h1>
        </div>
        
        {isLoadingBuyers && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              Erro ao carregar compradores: {error instanceof Error ? error.message : 'Erro desconhecido'}
            </AlertDescription>
          </Alert>
        )}
        
        {!isLoadingBuyers && !error && buyers && (
          <div className="border rounded-lg">
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
                {buyers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500 py-4">
                      Nenhum comprador encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  buyers.map((buyer) => {
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
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Status Change Dialog */}
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
    </AdminDashboardLayout>
  );
}
