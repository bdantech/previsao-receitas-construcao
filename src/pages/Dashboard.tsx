import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { toast } from "@/hooks/use-toast";
import { formatCNPJ } from "@/lib/formatters";

// Placeholder dashboard for company users
const Dashboard = () => {
  const { session, userRole, isLoading } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [companyName, setCompanyName] = useState<string>("");

  useEffect(() => {
    const fetchCompanyData = async () => {
      if (session?.access_token) {
        try {
          setLoadingCompanies(true);
          console.log('Fetching company data with token:', session.access_token);
          
          const { data, error } = await supabase.functions.invoke('user-company-data', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          });
          
          if (error) {
            console.error("Error invoking user-company-data function:", error);
            console.error("Error details:", error.message);
            toast({
              title: "Erro",
              description: "Não foi possível carregar os dados da empresa",
              variant: "destructive",
            });
            throw error;
          }
          
          console.log("Company data response:", data);
          
          if (!data.companies) {
            console.error("No companies array in response:", data);
            toast({
              title: "Erro",
              description: "Formato de resposta inválido do servidor",
              variant: "destructive",
            });
            throw new Error("Invalid response format");
          }
          
          setCompanies(data.companies);
          
          // Set company name if available
          if (data.companies && data.companies.length > 0) {
            console.log("Setting company name:", data.companies[0].name);
            setCompanyName(data.companies[0].name);
          } else {
            console.log("No companies found for user");
          }
        } catch (error) {
          console.error("Error fetching company data:", error);
          // You might want to show an error message to the user here
        } finally {
          setLoadingCompanies(false);
        }
      } else {
        console.log("No session access token available");
      }
    };

    fetchCompanyData();
  }, [session]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" />;
  }

  // If user is admin, redirect to admin dashboard
  if (userRole === 'admin') {
    return <Navigate to="/admin/dashboard" />;
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        {companyName && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-800">
              {companyName}
            </h1>
            <p className="text-gray-500 mt-1">Dashboard</p>
          </div>
        )}
        
        <h2 className="text-xl font-semibold mb-4">Seus dados de empresa</h2>
        
        {loadingCompanies ? (
          <div className="flex justify-center my-10">
            <Loader className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        ) : companies.length > 0 ? (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Detalhes da Empresa
              </h3>
            </div>
            <div className="border-t border-gray-200">
              <dl>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Nome</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {companies[0].name}
                  </dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">CNPJ</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {formatCNPJ(companies[0].cnpj)}
                  </dd>
                </div>
                {companies[0].website && (
                  <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Website</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      <a 
                        href={companies[0].website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {companies[0].website}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-lg shadow-sm text-center">
            <p className="text-gray-500">Nenhuma empresa encontrada.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
