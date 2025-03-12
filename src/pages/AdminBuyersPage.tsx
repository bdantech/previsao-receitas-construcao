
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

export default function AdminBuyersPage() {
  const { data: buyers, isLoading } = useQuery({
    queryKey: ['admin-buyers'],
    queryFn: () => projectBuyersApi.admin.getAllBuyers(),
  });

  return (
    <AdminDashboardLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Compradores</h1>
        
        {isLoading ? (
          <div>Carregando...</div>
        ) : (
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
              {buyers?.map((buyer) => (
                <TableRow key={buyer.id}>
                  <TableCell>{buyer.full_name}</TableCell>
                  <TableCell>{buyer.cpf}</TableCell>
                  <TableCell>{buyer.company_name}</TableCell>
                  <TableCell>{buyer.project_name}</TableCell>
                  <TableCell>{buyer.buyer_status}</TableCell>
                  <TableCell>{buyer.contract_status}</TableCell>
                  <TableCell>{buyer.credit_analysis_status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </AdminDashboardLayout>
  );
}
