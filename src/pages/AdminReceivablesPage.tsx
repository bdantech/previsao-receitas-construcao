import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Loader, Search } from "lucide-react";
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
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<{id: string, name: string}[]>([]);
  const [projects, setProjects] = useState<{id: string, name: string, company_id: string}[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<{id: string, name: string, company_id: string}[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalAmount: 0, count: 0 });

  // Calculate totals by status
  const calculateStatusTotals = () => {
    const totals = {
      total: 0,
      enviado: 0,
      reprovado: 0,
      elegivel_para_antecipacao: 0,
      antecipado: 0,
      pago: 0
    };

    receivables.forEach(receivable => {
      totals.total += Number(receivable.amount);
      
      if (receivable.status === 'enviado') totals.enviado += Number(receivable.amount);
      if (receivable.status === 'reprovado') totals.reprovado += Number(receivable.amount);
      if (receivable.status === 'elegivel_para_antecipacao') totals.elegivel_para_antecipacao += Number(receivable.amount);
      if (receivable.status === 'antecipado') totals.antecipado += Number(receivable.amount);
      if (receivable.status === 'pago') totals.pago += Number(receivable.amount);
    });

    return totals;
  };

  const statusTotals = calculateStatusTotals();

  // Fetch companies and projects
  const fetchCompaniesAndProjects = async () => {
    try {
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, name')
        .order('name');

      if (companiesError) throw companiesError;
      setCompanies(companiesData || []);

      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name, company_id')
        .order('name');

      if (projectsError) throw projectsError;
      setProjects(projectsData || []);
    } catch (error) {
      console.error('Error fetching companies and projects:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar as empresas e projetos.",
      });
    }
  };

  // Update filtered projects when company changes
  useEffect(() => {
    if (selectedCompanyId) {
      setFilteredProjects(projects.filter(project => project.company_id === selectedCompanyId));
      setSelectedProjectId(null);
    } else {
      setFilteredProjects(projects);
    }
  }, [selectedCompanyId, projects]);

  // Fetch companies and projects on mount
  useEffect(() => {
    if (session && userRole === 'admin') {
      fetchCompaniesAndProjects();
    }
  }, [session, userRole]);

  const fetchReceivables = async () => {
    if (session && userRole === 'admin') {
      try {
        setLoadingReceivables(true);
        
        // Prepare filters
        const filters: Record<string, any> = {};
        if (selectedStatus) {
          filters.status = selectedStatus;
        }
        if (selectedCompanyId) {
          filters.companyId = selectedCompanyId;
        }
        if (selectedProjectId) {
          filters.projectId = selectedProjectId;
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
    setSelectedCompanyId(null);
    setSelectedProjectId(null);
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
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Recebíveis</h1>
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
          <p className="text-sm text-gray-500 mt-1">{receivables.length} recebíveis</p>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Status</h3>
          <div className="space-y-2 mt-2">
            <div className="flex justify-between items-center">
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Enviado</Badge>
              <span className="font-medium">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(statusTotals.enviado)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <Badge variant="outline" className="bg-green-100 text-green-800">Elegível para Antecipação</Badge>
              <span className="font-medium">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(statusTotals.elegivel_para_antecipacao)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <Badge variant="outline" className="bg-red-100 text-red-800">Reprovado</Badge>
              <span className="font-medium">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(statusTotals.reprovado)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <Badge variant="outline" className="bg-blue-100 text-blue-800">Antecipado</Badge>
              <span className="font-medium">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(statusTotals.antecipado)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <Badge variant="outline" className="bg-purple-100 text-purple-800">Pago</Badge>
              <span className="font-medium">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(statusTotals.pago)}
              </span>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Resumo</h3>
          <div className="space-y-2 mt-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Total de Recebíveis:</span>
              <span className="font-medium">{receivables.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Valor Médio:</span>
              <span className="font-medium">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(receivables.length > 0 ? statusTotals.total / receivables.length : 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <Select
              value={selectedCompanyId || "all"}
              onValueChange={(value) => setSelectedCompanyId(value === "all" ? null : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Projeto</label>
            <Select
              value={selectedProjectId || "all"}
              onValueChange={(value) => setSelectedProjectId(value === "all" ? null : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por projeto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os projetos</SelectItem>
                {filteredProjects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
      </div>
      
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
    </div>
  );
};

export default AdminReceivablesPage;
