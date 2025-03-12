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
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCPF } from "@/lib/formatters";

export default function AdminBuyersPage() {
  const { data: buyers, isLoading, error } = useQuery({
    queryKey: ['admin-buyers'],
    queryFn: async () => {
      try {
        const data = await projectBuyersApi.admin.getAllBuyers();
        console.log('Buyers data:', data);
        return data;
      } catch (error) {
        console.error('Error fetching buyers:', error);
        throw error;
      }
    },
  });

  const getStatusDisplay = (status: string) => {
    const statusMap: Record<string, { label: string, className: string }> = {
      'aprovado': { label: 'Aprovado', className: 'text-green-600' },
      'reprovado': { label: 'Reprovado', className: 'text-red-600' },
      'a_analisar': { label: 'A Analisar', className: 'text-yellow-600' },
      'a_enviar': { label: 'A Enviar', className: 'text-blue-600' },
    };

    return statusMap[status] || { label: status, className: 'text-gray-600' };
  };

  return (
    <AdminDashboardLayout>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight">Compradores</h1>
        </div>
        
        {isLoading && (
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
        
        {!isLoading && !error && buyers && (
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {buyers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 py-4">
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
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminDashboardLayout>
  );
}
