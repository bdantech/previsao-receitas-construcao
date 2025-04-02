
import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { BoletosTable, Boleto, BoletosFilters } from "@/components/boletos/BoletosTable";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EditBoletoDialog } from "@/components/boletos/EditBoletoDialog";
import { useAuth } from "@/hooks/useAuth";

const BoletosPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [boletos, setBoletos] = useState<Boleto[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedBoleto, setSelectedBoleto] = useState<Boleto | null>(null);
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

      const { data, error } = await supabase.functions.invoke("company-boletos", {
        body: {
          action: "getBoletos",
          data: {
            filters: filterData,
          },
        },
        headers: await getAuthHeader(),
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

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Boletos</h1>
        </div>

        <BoletosTable
          boletos={boletos}
          isLoading={isLoading}
          onUpdate={handleEditBoleto}
          onFilterChange={handleFilterChange}
          filters={filters}
          isAdmin={false}
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
      </div>
    </DashboardLayout>
  );
};

export default BoletosPage;
