import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatCNPJ } from "@/lib/formatters";
import { Loader } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

// Placeholder dashboard for company users
const Dashboard = () => {
  const { session, userRole, isLoading } = useAuth();
  const navigate = useNavigate()
  const [companies, setCompanies] = useState<any[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  
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

    if(isLoading || !userRole) return;

    if(userRole === 'admin'){
      return navigate('/admin/dashboard')
    }

    fetchCompanyData()
  }, [isLoading, userRole, session, navigate]);

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

  return (
    <DashboardLayout>
      <div className="flex flex-col min-h-screen">
        {/* Company Info Section */}
        {!loadingCompanies && companies.length > 0 && (
          <div className="px-6 pt-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              {companies[0].name}
            </h2>
            <p className="text-lg text-gray-600">
              {formatCNPJ(companies[0].cnpj)}
            </p>
            {companies[0].website && (
              <a 
                href={companies[0].website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 text-sm block mt-1"
              >
                {companies[0].website}
              </a>
            )}
          </div>
        )}

        {/* Loading State */}
        {loadingCompanies ? (
          <div className="flex justify-center my-10">
            <Loader className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        ) : companies.length === 0 ? (
          <div className="p-6">
            <div className="bg-white p-6 rounded-lg shadow-sm text-center">
              <p className="text-gray-500">Nenhuma empresa encontrada.</p>
            </div>
          </div>
        ) : (
          /* Main Content Section - Empty space instead of KPIs */
          <div className="flex-grow"></div>
        )}

        {/* Banner and Logo Section */}
        <div className="mt-auto px-6 pb-6">
          <div className="relative h-[300px]">
            <div 
              className="absolute inset-0 rounded-lg overflow-hidden"
              style={{
                backgroundImage: "url('/login-background.jpg')",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="absolute inset-0 bg-black/40">
                <div className="h-full flex flex-col items-center justify-center">
                  <h1 className="text-3xl md:text-4xl text-white font-bold text-center px-4">
                    Antecipando o Futuro para quem Constroi o Brasil
                  </h1>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center mt-8 mb-6">
            <img 
              src="/onepay-pro.png" 
              alt="OnePay Pro Logo" 
              className="h-12 w-auto"
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
