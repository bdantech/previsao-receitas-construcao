import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatStringDate } from "@/utils/helpers/formatDate.helper";
import { formatCPF } from "@/lib/formatters";
import {
  Eye,
  FileDown,
  Pencil,
  Receipt,
  Trash
} from "lucide-react";
import React, { useEffect, useState } from "react";

export type Boleto = {
  id: string;
  valor_face: number;
  valor_boleto: number;
  percentual_atualizacao: number | null;
  data_vencimento: string;
  data_emissao: string;
  status_emissao: 'Criado' | 'Emitido' | 'Cancelado';
  status_pagamento: 'N/A' | 'Pago' | 'Em Aberto' | 'Em Atraso';
  payer_tax_id: string;
  project_id: string;
  company_id: string;
  nosso_numero?: string;
  linha_digitavel?: string;
  external_id?: string;
  arquivo_boleto_path?: string;
  arquivo_boleto_name?: string;
  index_id?: string;
  indexes?: {
    id: string;
    name: string;
  };
  projects?: {
    id: string;
    name: string;
  };
  companies?: {
    id: string;
    name: string;
  };
  billing_receivables?: {
    id: string;
    receivable_id: string;
    installment_id: string;
    nova_data_vencimento: string;
    receivables?: {
      id: string;
      amount: number;
      buyer_name: string;
      buyer_cpf: string;
      due_date: string;
    };
    payment_installments?: {
      id: string;
      pmt: number;
      data_vencimento: string;
      numero_parcela: number;
    };
  };
};

export type BoletosFilters = {
  companyId?: string;
  projectId?: string;
  statusEmissao?: string;
  statusPagamento?: string;
  monthYear?: string;
};

export type BoletosTableProps = {
  boletos: Boleto[];
  isLoading: boolean;
  onUpdate: (boleto: Boleto) => void;
  onDelete?: (id: string) => void;
  onFilterChange: (filters: BoletosFilters) => void;
  filters: BoletosFilters;
  isAdmin?: boolean;
  onBulkEmitir?: (boletoIds: string[]) => void;
};

const getStatusEmissaoColor = (status: string) => {
  switch (status) {
    case 'Criado':
      return 'bg-yellow-100 text-yellow-800';
    case 'Emitido':
      return 'bg-green-100 text-green-800';
    case 'Cancelado':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getStatusPagamentoColor = (status: string) => {
  switch (status) {
    case 'N/A':
      return 'bg-gray-100 text-gray-800';
    case 'Pago':
      return 'bg-green-100 text-green-800';
    case 'Em Aberto':
      return 'bg-blue-100 text-blue-800';
    case 'Em Atraso':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const BoletosTable: React.FC<BoletosTableProps> = ({
  boletos,
  isLoading,
  onUpdate,
  onDelete,
  onFilterChange,
  filters,
  isAdmin = false,
  onBulkEmitir,
}) => {
  const { getAuthHeader } = useAuth();
  const { toast } = useToast();
  const [selectedBoletos, setSelectedBoletos] = useState<string[]>([]);
  const [companies, setCompanies] = useState<{id: string, name: string}[]>([]);
  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);
  
  // Reset selected boletos when boletos list changes
  useEffect(() => {
    setSelectedBoletos([]);
  }, [boletos]);

  // Fetch companies and projects for filters
  useEffect(() => {
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
          .select('id, name')
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

    fetchCompaniesAndProjects();
  }, []);

  const handleSelectBoleto = (boletoId: string, checked: boolean) => {
    setSelectedBoletos(prev => 
      checked 
        ? [...prev, boletoId]
        : prev.filter(id => id !== boletoId)
    );
  };

  const handleSelectAllBoletos = (checked: boolean) => {
    const today = new Date().toISOString().split('T')[0];
    const criadoBoletos = boletos.filter(b => 
      b.status_emissao === 'Criado' && 
      b.data_vencimento >= today
    );
    setSelectedBoletos(checked ? criadoBoletos.map(b => b.id) : []);
  };

  const handleBulkEmitir = () => {
    if (onBulkEmitir && selectedBoletos.length > 0) {
      onBulkEmitir(selectedBoletos);
      setSelectedBoletos([]); // Reset selection after action
    }
  };

  const handleMonthYearChange = (value: string) => {
    onFilterChange({
      ...filters,
      monthYear: value,
    });
  };

  const handleStatusEmissaoChange = (value: string) => {
    onFilterChange({
      ...filters,
      statusEmissao: value,
    });
  };

  const handleStatusPagamentoChange = (value: string) => {
    onFilterChange({
      ...filters,
      statusPagamento: value,
    });
  };

  const handleCompanyChange = (value: string) => {
    onFilterChange({
      ...filters,
      companyId: value === 'all' ? undefined : value,
    });
  };

  const handleProjectChange = (value: string) => {
    onFilterChange({
      ...filters,
      projectId: value === 'all' ? undefined : value,
    });
  };

  const handleDownload = async (boleto: Boleto) => {
    const { data, error } = await supabase.functions.invoke("storage-management", {
      body: {
        action: "downloadFile",
        data: {
          bucketName: 'documents',
          filePath: boleto.arquivo_boleto_path,
        },
      },
      headers: getAuthHeader(),
    });

    if (error) {
      console.error("Error getting download URL:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: `Erro ao preparar o download: ${error.message}`,
      });
      return;
    }
    
    if (!data || !data.url) {
      throw new Error("Failed to get download URL");
    }

    const link = document.createElement('a');
    link.href = data.url;
    link.download = boleto.arquivo_boleto_name || 'boleto.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleEmitirBoleto = async (boleto: Boleto) => {
    try {
      const authHeader = await getAuthHeader();
      const { data, error } = await supabase.functions.invoke("starkbank-integration", {
        body: {
          action: "emitirBoleto",
          data: {
            boletoId: boleto.id,
            projectId: boleto.project_id
          },
        },
        headers: authHeader
      });

      if (error) {
        console.error("Error emitting boleto:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível emitir o boleto.",
        });
        return;
      }

      toast({
        title: "Boleto emitido com sucesso",
        description: "O boleto foi emitido e será processado em breve.",
      });

      // Refresh the table
      window.location.reload();
    } catch (error) {
      console.error("Error:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao emitir boleto.",
      });
    }
  };

  // Determine if we're in the project dashboard context
  const isProjectContext = Boolean(filters.projectId);

  // Calculate totals for each status
  const calculateStatusTotals = () => {
    const totals = {
      total: 0,
      criado: 0,
      emitido: 0,
      cancelado: 0,
      pago: 0,
      emAberto: 0,
      emAtraso: 0
    };

    boletos.forEach(boleto => {
      totals.total += boleto.valor_boleto;
      
      // Status de Emissão
      if (boleto.status_emissao === 'Criado') totals.criado += boleto.valor_boleto;
      if (boleto.status_emissao === 'Emitido') totals.emitido += boleto.valor_boleto;
      if (boleto.status_emissao === 'Cancelado') totals.cancelado += boleto.valor_boleto;
      
      // Status de Pagamento
      if (boleto.status_pagamento === 'Pago') totals.pago += boleto.valor_boleto;
      if (boleto.status_pagamento === 'Em Aberto') totals.emAberto += boleto.valor_boleto;
      if (boleto.status_pagamento === 'Em Atraso') totals.emAtraso += boleto.valor_boleto;
    });

    return totals;
  };

  const statusTotals = calculateStatusTotals();

  return (
    <div className="space-y-4">
      {/* Status Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Total Geral</h3>
          <p className="text-2xl font-bold mt-2">
            {new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(statusTotals.total)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Status de Emissão</h3>
          <div className="space-y-2 mt-2">
            <div className="flex justify-between items-center">
              <Badge className={getStatusEmissaoColor('Criado')}>Criado</Badge>
              <span className="font-medium">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(statusTotals.criado)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <Badge className={getStatusEmissaoColor('Emitido')}>Emitido</Badge>
              <span className="font-medium">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(statusTotals.emitido)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <Badge className={getStatusEmissaoColor('Cancelado')}>Cancelado</Badge>
              <span className="font-medium">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(statusTotals.cancelado)}
              </span>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Status de Pagamento</h3>
          <div className="space-y-2 mt-2">
            <div className="flex justify-between items-center">
              <Badge className={getStatusPagamentoColor('Pago')}>Pago</Badge>
              <span className="font-medium">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(statusTotals.pago)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <Badge className={getStatusPagamentoColor('Em Aberto')}>Em Aberto</Badge>
              <span className="font-medium">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(statusTotals.emAberto)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <Badge className={getStatusPagamentoColor('Em Atraso')}>Em Atraso</Badge>
              <span className="font-medium">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(statusTotals.emAtraso)}
              </span>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <h3 className="text-sm font-medium text-gray-500">Resumo</h3>
          <div className="space-y-2 mt-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Total de Boletos:</span>
              <span className="font-medium">{boletos.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Selecionados:</span>
              <span className="font-medium">{selectedBoletos.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-500">Filtros</h3>
          <Button variant="outline" size="sm" onClick={() => onFilterChange({})}>
            Limpar Filtros
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {!isProjectContext && (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium">Empresa</label>
                <Select value={filters.companyId || 'all'} onValueChange={handleCompanyChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as empresas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as empresas</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Projeto</label>
                <Select value={filters.projectId || 'all'} onValueChange={handleProjectChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os projetos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os projetos</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="space-y-1">
            <label className="text-sm font-medium">Mês/Ano de Vencimento</label>
            <MonthYearPicker
              value={filters.monthYear || ''}
              onChange={handleMonthYearChange}
              placeholder="Selecione mês/ano"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Status de Emissão</label>
            <Select value={filters.statusEmissao || 'all'} onValueChange={handleStatusEmissaoChange}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="Criado">Criado</SelectItem>
                <SelectItem value="Emitido">Emitido</SelectItem>
                <SelectItem value="Cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Status de Pagamento</label>
            <Select value={filters.statusPagamento || 'all'} onValueChange={handleStatusPagamentoChange}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="N/A">N/A</SelectItem>
                <SelectItem value="Pago">Pago</SelectItem>
                <SelectItem value="Em Aberto">Em Aberto</SelectItem>
                <SelectItem value="Em Atraso">Em Atraso</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isAdmin && onBulkEmitir && selectedBoletos.length > 0 && (
            <div className="flex items-end">
              <Button onClick={handleBulkEmitir} variant="default">
                <Receipt className="mr-2 h-4 w-4" />
                Emitir Boletos Selecionados ({selectedBoletos.length})
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && onBulkEmitir && (
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={
                      boletos.filter(b => 
                        b.status_emissao === 'Criado' && 
                        b.data_vencimento >= new Date().toISOString().split('T')[0]
                      ).length > 0 &&
                      selectedBoletos.length === boletos.filter(b => 
                        b.status_emissao === 'Criado' && 
                        b.data_vencimento >= new Date().toISOString().split('T')[0]
                      ).length
                    }
                    onCheckedChange={(checked) => handleSelectAllBoletos(checked === true)}
                  />
                </TableHead>
              )}
              {!isProjectContext && <TableHead>Empresa</TableHead>}
              {!isProjectContext && <TableHead>Projeto</TableHead>}
              <TableHead>Pagador</TableHead>
              <TableHead>Valor do Boleto</TableHead>
              <TableHead>Data de Vencimento</TableHead>
              <TableHead>Status Emissão</TableHead>
              <TableHead>Status Pagamento</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isProjectContext ? 7 : 9} className="text-center py-4">
                  Carregando boletos...
                </TableCell>
              </TableRow>
            ) : boletos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isProjectContext ? 7 : 9} className="text-center py-4">
                  Nenhum boleto encontrado.
                </TableCell>
              </TableRow>
            ) : (
              boletos.map((boleto) => (
                <TableRow key={boleto.id}>
                  {isAdmin && onBulkEmitir && (
                    <TableCell>
                      <Checkbox
                        checked={selectedBoletos.includes(boleto.id)}
                        onCheckedChange={(checked) => handleSelectBoleto(boleto.id, checked === true)}
                        disabled={
                          boleto.status_emissao !== 'Criado' || 
                          boleto.data_vencimento < new Date().toISOString().split('T')[0]
                        }
                      />
                    </TableCell>
                  )}
                  {!isProjectContext && <TableCell>{boleto.companies?.name || 'N/A'}</TableCell>}
                  {!isProjectContext && <TableCell>{boleto.projects?.name || 'N/A'}</TableCell>}
                  <TableCell>
                    {boleto.billing_receivables?.receivables?.buyer_name || 'N/A'}
                    <div className="text-xs text-gray-500">{formatCPF(boleto.payer_tax_id)}</div>
                  </TableCell>
                  <TableCell>
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(boleto.valor_boleto)}
                    {boleto.percentual_atualizacao && (
                      <div className="text-xs text-gray-500">
                        {boleto.percentual_atualizacao > 0 ? '+' : ''}
                        {boleto.percentual_atualizacao.toFixed(2)}%
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {formatStringDate(boleto.data_vencimento)}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusEmissaoColor(boleto.status_emissao)}>
                      {boleto.status_emissao}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusPagamentoColor(boleto.status_pagamento)}>
                      {boleto.status_pagamento}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {isAdmin ? (
                        <>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => onUpdate(boleto)}
                            title="Editar Boleto"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {boleto.status_emissao === 'Criado' && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleEmitirBoleto(boleto)}
                              title="Emitir Boleto"
                            >
                              <Receipt className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => onUpdate(boleto)}
                          title="Ver Detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      {boleto.arquivo_boleto_path && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDownload(boleto)}
                          title="Download do Boleto"
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                      )}
                      {isAdmin && onDelete && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => onDelete(boleto.id)}
                          title="Excluir Boleto"
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
