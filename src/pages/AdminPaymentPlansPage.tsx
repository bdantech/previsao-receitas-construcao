
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AdminDashboardLayout } from "@/components/dashboard/AdminDashboardLayout";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { Loader, ArrowRight, Calendar } from "lucide-react";
import { format } from "date-fns";

interface Company {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  company_id: string;
}

interface PaymentPlan {
  id: string;
  dia_cobranca: number;
  teto_fundo_reserva: number;
  anticipation_request_id: string;
  project_id: string;
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
}

const AdminPaymentPlansPage = () => {
  const { session, userRole } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [paymentPlans, setPaymentPlans] = useState<PaymentPlan[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (session && userRole === 'admin') {
      fetchCompanies();
      fetchProjects();
      fetchPaymentPlans();
    }
  }, [session, userRole]);

  useEffect(() => {
    if (selectedCompanyId) {
      setFilteredProjects(projects.filter(project => project.company_id === selectedCompanyId));
      setSelectedProjectId("");
    } else {
      setFilteredProjects(projects);
    }
  }, [selectedCompanyId, projects]);

  useEffect(() => {
    if (session && userRole === 'admin') {
      fetchPaymentPlans();
    }
  }, [selectedCompanyId, selectedProjectId, session, userRole]);

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('company-data', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        },
        body: {} // Empty body for default admin action (fetch all companies)
      });
      
      if (error) {
        console.error("Error fetching companies:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível carregar as empresas."
        });
        return;
      }
      
      if (data && data.companies) {
        setCompanies(data.companies);
      }
    } catch (error) {
      console.error("Error fetching companies:", error);
    }
  };

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, company_id');
      
      if (error) {
        console.error("Error fetching projects:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível carregar os projetos."
        });
        return;
      }
      
      if (data) {
        setProjects(data);
        setFilteredProjects(data);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  };

  const fetchPaymentPlans = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('admin-payment-plans', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        },
        body: {
          action: 'getPaymentPlans',
          projectId: selectedProjectId || undefined
        }
      });
      
      if (error) {
        console.error("Error fetching payment plans:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível carregar os planos de pagamento."
        });
        return;
      }
      
      if (data) {
        let filteredPlans = data.data;
        
        // Filter by company if selected
        if (selectedCompanyId && !selectedProjectId) {
          const companyProjects = projects.filter(
            project => project.company_id === selectedCompanyId
          ).map(project => project.id);
          
          filteredPlans = filteredPlans.filter(
            (plan: PaymentPlan) => companyProjects.includes(plan.project_id)
          );
        }
        
        setPaymentPlans(filteredPlans);
      }
    } catch (error) {
      console.error("Error fetching payment plans:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível carregar os planos de pagamento."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCompanyChange = (value: string) => {
    setSelectedCompanyId(value);
  };

  const handleProjectChange = (value: string) => {
    setSelectedProjectId(value);
  };

  const handleClearFilters = () => {
    setSelectedCompanyId("");
    setSelectedProjectId("");
  };

  const handleViewDetail = (paymentPlanId: string) => {
    navigate(`/admin/payment-plans/${paymentPlanId}`);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <AdminDashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Planos de Pagamento</h2>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Empresa</label>
              <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma empresa" />
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
            
            <div>
              <label className="block text-sm font-medium mb-1">Projeto</label>
              <Select value={selectedProjectId} onValueChange={handleProjectChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um projeto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os projetos</SelectItem>
                  {filteredProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={handleClearFilters}
                className="w-full"
              >
                Limpar filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center my-10">
          <Loader className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">
              Planos de Pagamento
            </h3>
            <span className="text-sm text-gray-500">
              {paymentPlans.length} {paymentPlans.length === 1 ? 'plano' : 'planos'} encontrados
            </span>
          </div>
          
          {paymentPlans.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Projeto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dia de Cobrança
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Teto do Fundo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor Antecipação
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Criado em
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paymentPlans.map((plan) => (
                    <tr key={plan.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {plan.projects.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        Dia {plan.dia_cobranca}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(plan.teto_fundo_reserva)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(plan.anticipation_requests.valor_total)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(plan.created_at), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetail(plan.id)}
                          className="text-blue-600 hover:text-blue-900 flex items-center"
                        >
                          Detalhes
                          <ArrowRight className="ml-1 h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-4 text-center text-gray-500">
              Nenhum plano de pagamento encontrado.
            </div>
          )}
        </div>
      )}
    </AdminDashboardLayout>
  );
};

export default AdminPaymentPlansPage;
