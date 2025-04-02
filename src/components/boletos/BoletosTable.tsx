
import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileDown, 
  Pencil, 
  Trash,
  Eye
} from "lucide-react";
import { MonthYearPicker } from "@/components/ui/month-year-picker";

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

type BoletosTableProps = {
  boletos: Boleto[];
  isLoading: boolean;
  onUpdate: (boleto: Boleto) => void;
  onDelete?: (id: string) => void;
  onFilterChange: (filters: BoletosFilters) => void;
  filters: BoletosFilters;
  isAdmin?: boolean;
};

export type BoletosFilters = {
  companyId?: string;
  projectId?: string;
  statusEmissao?: string;
  statusPagamento?: string;
  monthYear?: string;
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
}) => {
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

  // Determine if we're in the project dashboard context
  const isProjectContext = Boolean(filters.projectId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 pb-4">
        <div className="min-w-[220px]">
          <label className="text-sm font-medium mb-1 block">Mês/Ano de Vencimento</label>
          <MonthYearPicker
            value={filters.monthYear || ''}
            onChange={handleMonthYearChange}
            placeholder="Selecione mês/ano"
          />
        </div>
        <div className="min-w-[180px]">
          <label className="text-sm font-medium mb-1 block">Status de Emissão</label>
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
        <div className="min-w-[180px]">
          <label className="text-sm font-medium mb-1 block">Status de Pagamento</label>
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
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
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
                <TableCell colSpan={isProjectContext ? 6 : 8} className="text-center py-4">
                  Carregando boletos...
                </TableCell>
              </TableRow>
            ) : boletos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isProjectContext ? 6 : 8} className="text-center py-4">
                  Nenhum boleto encontrado.
                </TableCell>
              </TableRow>
            ) : (
              boletos.map((boleto) => (
                <TableRow key={boleto.id}>
                  {!isProjectContext && <TableCell>{boleto.companies?.name || 'N/A'}</TableCell>}
                  {!isProjectContext && <TableCell>{boleto.projects?.name || 'N/A'}</TableCell>}
                  <TableCell>
                    {boleto.billing_receivables?.receivables?.buyer_name || 'N/A'}
                    <div className="text-xs text-gray-500">{boleto.payer_tax_id}</div>
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
                    {format(new Date(boleto.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })}
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
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onUpdate(boleto)}
                        title="Editar Boleto"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {boleto.arquivo_boleto_path && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => window.open(boleto.arquivo_boleto_path, '_blank')}
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
