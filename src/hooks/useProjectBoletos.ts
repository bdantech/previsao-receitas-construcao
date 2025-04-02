
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Boleto, BoletosFilters } from "@/components/boletos/BoletosTable";
import { useToast } from "./use-toast";

export const useProjectBoletos = (projectId: string) => {
  const [boletos, setBoletos] = useState<Boleto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<BoletosFilters>({});
  const { toast } = useToast();
  const { getAuthHeader } = useAuth();

  // Set default filter to current month on initialization
  useEffect(() => {
    const now = new Date();
    const currentMonthYear = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    setFilters({ monthYear: currentMonthYear });
  }, []);

  // Fetch boletos when filters change
  useEffect(() => {
    if (projectId) {
      fetchBoletos();
    }
  }, [projectId, filters]);

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
        projectId,
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
    setFilters({ ...filters, ...newFilters });
  };

  return {
    boletos,
    isLoading,
    filters,
    handleFilterChange,
    refreshBoletos: fetchBoletos,
  };
};
