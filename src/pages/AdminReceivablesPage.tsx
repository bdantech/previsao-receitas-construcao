
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader } from "lucide-react";
import { AdminDashboardLayout } from "@/components/dashboard/AdminDashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Receivable {
  id: string;
  buyer_name: string;
  buyer_cpf: string;
  amount: number;
  due_date: string;
  status: string;
  project_name: string;
  company_name: string;
}

const statusLabels = {
  'enviado': 'Enviado',
  'reprovado': 'Reprovado',
  'elegivel_para_antecipacao': 'Elegível para Antecipação',
  'antecipado': 'Antecipado',
  'pago': 'Pago'
};

const statusColors = {
  'enviado': 'bg-yellow-100 text-yellow-800',
  'reprovado': 'bg-red-100 text-red-800',
  'elegivel_para_antecipacao': 'bg-green-100 text-green-800',
  'antecipado': 'bg-blue-100 text-blue-800',
  'pago': 'bg-purple-100 text-purple-800'
};

const AdminReceivablesPage = () => {
  const { session, userRole, isLoading } = useAuth();
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [loadingReceivables, setLoadingReceivables] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

  useEffect(() => {
    const fetchReceivables = async () => {
      if (session && userRole === 'admin') {
        try {
          setLoadingReceivables(true);
          
          // Prepare filters
          const filters: Record<string, any> = {};
          if (selectedStatus) {
            filters.status = selectedStatus;
          }
          
          const { data, error } = await supabase.functions.invoke('admin-receivables', {
            headers: {
              Authorization: `Bearer ${session.access_token}`
            },
            body: {
              method: 'GET',
              filters
            }
          });
          
          if (error) {
            console.error("Function invocation error:", error);
            toast({
              title: "Erro",
              description: "Falha ao carregar recebíveis. Tente novamente.",
              variant: "destructive"
            });
            throw error;
          }
          
          console.log("Receivables data received:", data);
          if (data && data.receivables) {
            setReceivables(data.receivables);
          } else {
            console.error("Unexpected response format:", data);
            toast({
              title: "Erro",
              description: "Formato de dados inválido recebido do servidor.",
              variant: "destructive"
            });
          }
        } catch (error) {
          console.error("Error fetching receivables:", error);
        } finally {
          setLoadingReceivables(false);
        }
      } else if (!isLoading) {
        setLoadingReceivables(false);
      }
    };

    fetchReceivables();
  }, [session, userRole, isLoading, selectedStatus]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatCpf = (cpf: string) => {
    if (!cpf) return '';
    // Format CPF: 123.456.789-00
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/admin/auth" />;
  }

  // If user is not admin, redirect to regular dashboard
  if (userRole !== 'admin') {
    return <Navigate to="/dashboard" />;
  }

  return (
    <AdminDashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Recebíveis</h2>
        <div className="w-64">
          <Select
            value={selectedStatus || "all"}
            onValueChange={(value) => setSelectedStatus(value === "all" ? null : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(statusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loadingReceivables ? (
            <div className="flex justify-center items-center h-64">
              <Loader className="h-8 w-8 animate-spin text-gray-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              {receivables.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Projeto</TableHead>
                      <TableHead>Comprador</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receivables.map((receivable) => (
                      <TableRow key={receivable.id}>
                        <TableCell className="font-medium">{receivable.company_name}</TableCell>
                        <TableCell>{receivable.project_name}</TableCell>
                        <TableCell>{receivable.buyer_name}</TableCell>
                        <TableCell>{formatCpf(receivable.buyer_cpf)}</TableCell>
                        <TableCell>{formatCurrency(receivable.amount)}</TableCell>
                        <TableCell>{formatDate(receivable.due_date)}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[receivable.status as keyof typeof statusColors]}>
                            {statusLabels[receivable.status as keyof typeof statusLabels] || receivable.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-10 text-gray-500">
                  Nenhum recebível encontrado.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </AdminDashboardLayout>
  );
};

export default AdminReceivablesPage;
