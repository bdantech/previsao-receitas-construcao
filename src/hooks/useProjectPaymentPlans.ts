
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";

export type PaymentPlan = {
  id: string;
  dia_cobranca: number;
  teto_fundo_reserva: number;
  anticipation_request_id: string;
  project_id: string;
  index_id?: string;
  adjustment_base_date?: string;
  created_at: string;
  updated_at: string;
  anticipation_requests: {
    valor_total: number;
    valor_liquido: number;
    status: string;
  };
  projects: {
    name: string;
    cnpj: string;
  };
  payment_plan_installments?: PaymentPlanInstallment[];
};

export type PaymentPlanInstallment = {
  id: string;
  numero_parcela: number;
  data_vencimento: string;
  recebiveis: number;
  pmt: number;
  saldo_devedor: number;
  fundo_reserva: number;
  devolucao: number;
};

export const useProjectPaymentPlans = (projectId: string) => {
  const [paymentPlans, setPaymentPlans] = useState<PaymentPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { getAuthHeader } = useAuth();

  useEffect(() => {
    if (projectId) {
      fetchPaymentPlans();
    }
  }, [projectId]);

  const fetchPaymentPlans = async () => {
    setIsLoading(true);
    try {
      console.log("Fetching payment plans for project:", projectId);
      const { data, error } = await supabase.functions.invoke("company-payment-plans", {
        body: {
          action: "getCompanyPaymentPlans",
        },
        headers: await getAuthHeader(),
      });

      if (error) {
        console.error("Error fetching payment plans:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível carregar os planos de pagamento.",
        });
        return;
      }

      // Filter payment plans for this project
      const projectPlans = data.filter((plan: PaymentPlan) => plan.project_id === projectId);
      console.log("Payment plans for project:", projectPlans);
      
      setPaymentPlans(projectPlans || []);
      
      // If there's at least one plan, select it by default
      if (projectPlans && projectPlans.length > 0) {
        await fetchPlanDetails(projectPlans[0].id);
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao carregar planos de pagamento.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPlanDetails = async (planId: string) => {
    setIsLoading(true);
    try {
      console.log("Fetching payment plan details:", planId);
      const { data, error } = await supabase.functions.invoke("company-payment-plans", {
        body: {
          action: "getPaymentPlanDetails",
          paymentPlanId: planId,
        },
        headers: await getAuthHeader(),
      });

      if (error) {
        console.error("Error fetching payment plan details:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível carregar os detalhes do plano de pagamento.",
        });
        return;
      }

      console.log("Payment plan details:", data);
      setSelectedPlan(data);
    } catch (error) {
      console.error("Error:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao carregar detalhes do plano de pagamento.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    paymentPlans,
    selectedPlan,
    isLoading,
    fetchPaymentPlans,
    fetchPlanDetails,
    setSelectedPlan,
  };
};
