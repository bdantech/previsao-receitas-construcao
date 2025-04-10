
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { Loader, RefreshCw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

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

interface Summary {
  totalAmount: number;
  count: number;
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
  const [companySearch, setCompanySearch] = useState<string>("");
  const [summary, setSummary] = useState<Summary>({ totalAmount: 0, count: 0 });

  const fetchReceivables = async () => {
    if (session && userRole === 'admin') {
      try {
        setLoadingReceivables(true);
        
        // Prepare filters
        const filters: Record<string, any> = {};
        if (selectedStatus) {
          filters.status = selectedStatus;
        }
        if (companySearch.trim()) {
          filters.companyName = companySearch.trim();
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
          
          // Set summary data
          if (data.summary) {
            setSummary(data.summary);
          } else {
            setSummary({ 
              totalAmount: data.receivables.reduce((sum: number, item: Receivable) => sum + Number(item.amount), 0),
              count: data.receivables.length
            });
          }
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

  useEffect(() => {
    fetchReceivables();
  }, [session, userRole, isLoading]);

  const handleSearch = () => {
    fetchReceivables();
  };

  const handleClearFilters = () => {
    setSelectedStatus(null);
    setCompanySearch("");
    fetchReceivables();
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
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Recebíveis</h2>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex items-center gap-2"
          onClick={fetchReceivables}
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>
      
      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Status</label>
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
            
            <div className="space-y-1">
              <label className="text-sm font-medium">Empresa</label>
              <div className="flex gap-2">
                <Input 
                  placeholder="Buscar por empresa" 
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-end gap-2 mt-4">
            <Button variant="outline" onClick={handleClearFilters}>
              Limpar Filtros
            </Button>
            <Button onClick={handleSearch} className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Summary Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Resumo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Total de Recebíveis</div>
              <div className="text-2xl font-bold">{summary.count}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Valor Total</div>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalAmount)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Receivables List */}
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
    </>
  );
};

export default AdminReceivablesPage;
