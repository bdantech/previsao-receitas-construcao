
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader } from "lucide-react";

// Placeholder dashboard for company users
const Dashboard = () => {
  const { session, userRole, isLoading, signOut } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  useEffect(() => {
    const fetchCompanyData = async () => {
      if (session) {
        try {
          const { data, error } = await supabase.functions.invoke('company-data');
          
          if (error) throw error;
          setCompanies(data.companies || []);
        } catch (error) {
          console.error("Error fetching company data:", error);
        } finally {
          setLoadingCompanies(false);
        }
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto p-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-[#1A1F2C]">ONE pay</h1>
          <Button variant="outline" onClick={signOut}>
            Sair
          </Button>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
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
                      {companies[0].cnpj}
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
      </main>
    </div>
  );
};

export default Dashboard;
