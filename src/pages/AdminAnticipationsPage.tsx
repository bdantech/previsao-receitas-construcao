import { AdminAnticipationDetails } from "@/components/anticipations/AdminAnticipationDetails";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Eye, Loader, RefreshCw, Search } from "lucide-react";
import { useEffect, useState } from 'react';

interface Company {
  name: string;
  cnpj: string;
}

interface Project {
  name: string;
}

interface Anticipation {
  id: string;
  company_id: string;
  project_id: string;
  valor_total: number;
  valor_liquido: number;
  status: string;
  quantidade_recebiveis: number;
  created_at: string;
  updated_at: string;
  companies: Company;
  projects: Project;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const AdminAnticipationsPage = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [anticipations, setAnticipations] = useState<Anticipation[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0
  });
  
  // Filters
  const [status, setStatus] = useState<string>("");
  const [companySearch, setCompanySearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  
  // For viewing anticipation details
  const [selectedAnticipationId, setSelectedAnticipationId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  
  // Calculate totals by status
  const calculateStatusTotals = () => {
    const totals = {
      total: 0,
      Solicitada: 0,
      Aprovada: 0,
      Reprovada: 0,
      Concluída: 0
    };

    anticipations.forEach(anticipation => {
      totals.total += Number(anticipation.valor_total);
      
      if (anticipation.status === 'Solicitada') totals.Solicitada += Number(anticipation.valor_total);
      if (anticipation.status === 'Aprovada') totals.Aprovada += Number(anticipation.valor_total);
      if (anticipation.status === 'Reprovada') totals.Reprovada += Number(anticipation.valor_total);
      if (anticipation.status === 'Concluída') totals.Concluída += Number(anticipation.valor_total);
    });

    return totals;
  };

  const statusTotals = calculateStatusTotals();
  
  const fetchAnticipations = async (page = 1) => {
    if (!session?.access_token) return;
    
    try {
      setIsLoading(true);
      
      const filters: Record<string, any> = {
        page,
        pageSize: pagination.pageSize
      };
      
      if (status) filters.status = status;
      if (companySearch) filters.companySearch = companySearch;
      if (dateFrom) filters.fromDate = dateFrom;
      if (dateTo) filters.toDate = dateTo;
      
      console.log('Sending filters to edge function:', filters);
      
      const { data, error } = await supabase.functions.invoke('admin-anticipations', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          action: 'getAllAnticipations',
          ...filters
        }
      });
      
      if (error) throw error;
      
      if (data.anticipations && Array.isArray(data.anticipations)) {
        setAnticipations(data.anticipations);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Error fetching anticipations:', error);
      toast({
        title: "Erro ao carregar antecipações",
        description: "Não foi possível obter a lista de antecipações.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchAnticipations(1);
  }, [session, status]);
  
  const handleSearch = () => {
    fetchAnticipations(1);
  };
  
  const handleClearFilters = () => {
    setStatus("");
    setCompanySearch("");
    setDateFrom("");
    setDateTo("");
    fetchAnticipations(1);
  };
  
  const handlePageChange = (newPage: number) => {
    fetchAnticipations(newPage);
  };
  
  const handleViewDetails = (anticipationId: string) => {
    setSelectedAnticipationId(anticipationId);
    setShowDetails(true);
  };
  
  const handleCloseDetails = () => {
    setSelectedAnticipationId(null);
    setShowDetails(false);
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Solicitada':
        return <Badge variant="warning">Solicitada</Badge>;
      case 'Aprovada':
        return <Badge variant="success">Aprovada</Badge>;
      case 'Reprovada':
        return <Badge variant="destructive">Reprovada</Badge>;
      case 'Concluída':
        return <Badge className="bg-blue-500">Concluída</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };
  
  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Antecipações</h1>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex items-center gap-2"
          onClick={() => fetchAnticipations(pagination.page)}
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>
      
      {/* Status Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Total Geral</h3>
          <p className="text-2xl font-bold mt-2">
            {new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(statusTotals.total)}
          </p>
          <p className="text-sm text-gray-500 mt-1">{anticipations.length} antecipações</p>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Status</h3>
          <div className="space-y-2 mt-2">
            <div className="flex justify-between items-center">
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Solicitada</Badge>
              <span className="font-medium">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(statusTotals.Solicitada)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <Badge variant="outline" className="bg-green-100 text-green-800">Aprovada</Badge>
              <span className="font-medium">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(statusTotals.Aprovada)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <Badge variant="outline" className="bg-red-100 text-red-800">Reprovada</Badge>
              <span className="font-medium">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(statusTotals.Reprovada)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <Badge variant="outline" className="bg-blue-100 text-blue-800">Concluída</Badge>
              <span className="font-medium">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(statusTotals.Concluída)}
              </span>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Resumo</h3>
          <div className="space-y-2 mt-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Total de Antecipações:</span>
              <span className="font-medium">{anticipations.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Valor Médio:</span>
              <span className="font-medium">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(anticipations.length > 0 ? statusTotals.total / anticipations.length : 0)}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-500">Filtros</h3>
          <Button variant="outline" size="sm" onClick={handleClearFilters}>
            Limpar Filtros
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="Solicitada">Solicitada</SelectItem>
                <SelectItem value="Aprovada">Aprovada</SelectItem>
                <SelectItem value="Reprovada">Reprovada</SelectItem>
                <SelectItem value="Concluída">Concluída</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium">Empresa</label>
            <Input 
              placeholder="Buscar por empresa" 
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium">Data Inicial</label>
            <Input 
              type="date" 
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium">Data Final</label>
            <Input 
              type="date" 
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex items-center justify-end mt-4">
          <Button onClick={handleSearch} className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Buscar
          </Button>
        </div>
      </div>
      
      {/* Anticipations List */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Antecipações</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader className="h-8 w-8 animate-spin text-gray-500" />
            </div>
          ) : anticipations.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-500">Nenhuma antecipação encontrada.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-right">Valor Líquido</TableHead>
                    <TableHead className="text-center">Recebíveis</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {anticipations.map((anticipation) => (
                    <TableRow key={anticipation.id}>
                      <TableCell>
                        {format(new Date(anticipation.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {anticipation.companies?.name}
                      </TableCell>
                      <TableCell>
                        {anticipation.projects?.name}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(anticipation.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(anticipation.valor_total)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(anticipation.valor_liquido)}
                      </TableCell>
                      <TableCell className="text-center">
                        {anticipation.quantidade_recebiveis}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleViewDetails(anticipation.id)}
                            title="Ver Detalhes"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-500">
                  Mostrando {(pagination.page - 1) * pagination.pageSize + 1} a {Math.min(pagination.page * pagination.pageSize, pagination.total)} de {pagination.total} resultados
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={pagination.page === 1}
                    onClick={() => handlePageChange(pagination.page - 1)}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm">
                    Página {pagination.page} de {pagination.totalPages}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={pagination.page === pagination.totalPages}
                    onClick={() => handlePageChange(pagination.page + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      
      {/* Anticipation Details Modal */}
      {showDetails && selectedAnticipationId && (
        <AdminAnticipationDetails 
          anticipationId={selectedAnticipationId} 
          onClose={handleCloseDetails}
          onStatusUpdate={() => fetchAnticipations(pagination.page)}
        />
      )}
    </div>
  );
};

export default AdminAnticipationsPage;
