
import React, { useEffect, useState } from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader } from "lucide-react";
import { formatCPF } from "@/lib/formatters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BuyerActionButtons } from "./BuyerActionButtons";
import { projectBuyersApi } from "@/integrations/supabase/client";

export interface ProjectBuyer {
  id: string;
  full_name: string;
  cpf: string;
  buyer_status: 'aprovado' | 'reprovado' | 'a_analisar';
  contract_status: 'aprovado' | 'reprovado' | 'a_enviar' | 'a_analisar';
  credit_analysis_status: 'aprovado' | 'reprovado' | 'a_analisar';
  created_at: string;
  updated_at: string;
  contract_file_path?: string;
  contract_file_name?: string;
  project_name?: string;
  company_name?: string;
}

export function AdminBuyersTable() {
  const [buyers, setBuyers] = useState<ProjectBuyer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const fetchBuyers = async () => {
    try {
      setIsLoading(true);
      const buyersData = await projectBuyersApi.admin.getAllBuyers();
      setBuyers(buyersData);
    } catch (error) {
      console.error('Error fetching buyers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBuyers();
  }, []);

  const getBuyerStatusBadge = (status: string) => {
    switch (status) {
      case 'aprovado':
        return <Badge variant="success">Aprovado</Badge>;
      case 'reprovado':
        return <Badge variant="destructive">Reprovado</Badge>;
      case 'a_analisar':
        return <Badge variant="warning">Em Análise</Badge>;
      default:
        return <Badge variant="secondary">A Enviar</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>CPF</TableHead>
          <TableHead>Projeto</TableHead>
          <TableHead>Empresa</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Contrato</TableHead>
          <TableHead>Análise de Crédito</TableHead>
          <TableHead>Data de Cadastro</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {buyers.length > 0 ? (
          buyers.map((buyer) => (
            <TableRow key={buyer.id}>
              <TableCell className="font-medium">{buyer.full_name}</TableCell>
              <TableCell>{formatCPF(buyer.cpf)}</TableCell>
              <TableCell>{buyer.project_name || "-"}</TableCell>
              <TableCell>{buyer.company_name || "-"}</TableCell>
              <TableCell>{getBuyerStatusBadge(buyer.buyer_status)}</TableCell>
              <TableCell>{getBuyerStatusBadge(buyer.contract_status)}</TableCell>
              <TableCell>{getBuyerStatusBadge(buyer.credit_analysis_status)}</TableCell>
              <TableCell>
                {format(new Date(buyer.created_at), 'dd/MM/yyyy', { locale: ptBR })}
              </TableCell>
              <TableCell className="text-right">
                <BuyerActionButtons 
                  buyer={buyer} 
                  onStatusUpdated={fetchBuyers} 
                />
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={9} className="text-center py-6 text-gray-500">
              Nenhum comprador encontrado
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
