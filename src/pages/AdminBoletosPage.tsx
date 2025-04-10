import { Boleto, BoletosFilters, BoletosTable } from "@/components/boletos/BoletosTable";
import { CreateBoletosDialog } from "@/components/boletos/CreateBoletosDialog";
import { EditBoletoDialog } from "@/components/boletos/EditBoletoDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";
import React, { useEffect, useState } from "react";

const AdminBoletosPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [boletos, setBoletos] = useState<Boleto[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedBoleto, setSelectedBoleto] = useState<Boleto | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [boletoToDelete, setBoletoToDelete] = useState<string | null>(null);
  const [filters, setFilters] = useState<BoletosFilters>({});
  const { toast } = useToast();
  const { getAuthHeader } = useAuth();

  // Fetch boletos on load and when filters change
  useEffect(() => {
    fetchBoletos();
  }, [filters]);

  const fetchBoletos = async () => {
    setIsLoading(true);
    try {
      // Convert month-year filter to date range if needed
      let fromDate, toDate;
      if (filters.monthYear) {
        const [year, month] = filters.monthYear.split('-');
        const monthInt = parseInt(month);
        const yearInt = parseInt(year);
        
        // Create date for first day of month
        fromDate = new Date(yearInt, monthInt - 1, 1)
          .toISOString()
          .split('T')[0];
        
        // Create date for last day of month
        toDate = new Date(yearInt, monthInt, 0)
          .toISOString()
          .split('T')[0];
      }

      // Prepare filters
      const filterData = {
        ...filters,
        fromDate,
        toDate,
      };
      
      // Remove "all" values from filters before sending to API
      if (filterData.statusEmissao === 'all') {
        delete filterData.statusEmissao;
      }
      
      if (filterData.statusPagamento === 'all') {
        delete filterData.statusPagamento;
      }

      const { data, error } = await supabase.functions.invoke("admin-boletos", {
        body: {
          action: "getBoletos",
          data: {
            filters: filterData,
          },
        },
        headers: getAuthHeader(),
      });

      if (error) {
        console.error("Error fetching boletos:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível carregar os boletos.",
        });
        return;
      }

      setBoletos(data.boletos || []);
    } catch (error) {
      console.error("Error:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao carregar boletos.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (newFilters: BoletosFilters) => {
    setFilters(newFilters);
  };

  const handleEditBoleto = (boleto: Boleto) => {
    setSelectedBoleto(boleto);
    setEditDialogOpen(true);
  };

  const handleDeleteBoleto = (id: string) => {
    setBoletoToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteBoleto = async () => {
    if (!boletoToDelete) return;

    try {
      const { error } = await supabase.functions.invoke("admin-boletos", {
        body: {
          action: "deleteBoleto",
          data: {
            boletoId: boletoToDelete,
          },
        },
        headers: getAuthHeader(),
      });

      if (error) {
        console.error("Error deleting boleto:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível excluir o boleto.",
        });
        return;
      }

      toast({
        title: "Boleto excluído com sucesso",
        description: "O boleto foi excluído do sistema.",
      });
      
      fetchBoletos();
    } catch (error) {
      console.error("Error:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao excluir boleto.",
      });
    } finally {
      setDeleteDialogOpen(false);
      setBoletoToDelete(null);
    }
  };

  return (
    <>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Boletos</h1>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Gerar Boletos
          </Button>
        </div>

        <BoletosTable
          boletos={boletos}
          isLoading={isLoading}
          onUpdate={handleEditBoleto}
          onDelete={handleDeleteBoleto}
          onFilterChange={handleFilterChange}
          filters={filters}
          isAdmin={true}
        />

        <CreateBoletosDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          onSuccess={fetchBoletos}
        />

        <EditBoletoDialog
          boleto={selectedBoleto}
          open={editDialogOpen}
          onClose={() => {
            setEditDialogOpen(false);
            setSelectedBoleto(null);
          }}
          onSuccess={fetchBoletos}
        />

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Boleto</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este boleto? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteBoleto}
                className="bg-red-500 hover:bg-red-600"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
};

export default AdminBoletosPage;
