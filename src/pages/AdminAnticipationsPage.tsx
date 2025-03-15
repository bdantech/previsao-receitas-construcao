
import React, { useState, useEffect } from 'react';
import { AdminDashboardLayout } from "@/components/dashboard/AdminDashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Loader, Search, Eye, RefreshCw, Calendar, CheckSquare, XSquare } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/formatters";
import { AdminAnticipationDetails } from "@/components/anticipations/AdminAnticipationDetails";

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
  
  const fetchAnticipations = async (page = 1) => {
    if (!session?.access_token) return;
    
    try {
      setIsLoading(true);
      
      const filters: Record<string, any> = {
        page,
        pageSize: pagination.pageSize
      };
      
      if (status) filters.status = status;
      if (companySearch) filters.companyId = companySearch;
      if (dateFrom) filters.fromDate = dateFrom;
      if (dateTo) filters.toDate = dateTo;
      
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
    <AdminDashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Antecipações</h1>
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
        
        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
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
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Data</th>
                        <th className="text-left py-3 px-4 font-medium">Empresa</th>
                        <th className="text-left py-3 px-4 font-medium">Projeto</th>
                        <th className="text-left py-3 px-4 font-medium">Status</th>
                        <th className="text-right py-3 px-4 font-medium">Valor Total</th>
                        <th className="text-right py-3 px-4 font-medium">Valor Líquido</th>
                        <th className="text-center py-3 px-4 font-medium">Recebíveis</th>
                        <th className="text-right py-3 px-4 font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {anticipations.map((anticipation) => (
                        <tr key={anticipation.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">
                            {format(new Date(anticipation.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                          </td>
                          <td className="py-3 px-4">
                            {anticipation.companies?.name}
                          </td>
                          <td className="py-3 px-4">
                            {anticipation.projects?.name}
                          </td>
                          <td className="py-3 px-4">
                            {getStatusBadge(anticipation.status)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {formatCurrency(anticipation.valor_total)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {formatCurrency(anticipation.valor_liquido)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {anticipation.quantidade_recebiveis}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex items-center gap-1"
                              onClick={() => handleViewDetails(anticipation.id)}
                            >
                              <Eye className="h-4 w-4" />
                              Detalhes
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
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
      </div>
      
      {/* Anticipation Details Modal */}
      {showDetails && selectedAnticipationId && (
        <AdminAnticipationDetails 
          anticipationId={selectedAnticipationId} 
          onClose={handleCloseDetails}
          onStatusUpdate={() => fetchAnticipations(pagination.page)}
        />
      )}
    </AdminDashboardLayout>
  );
};

export default AdminAnticipationsPage;
