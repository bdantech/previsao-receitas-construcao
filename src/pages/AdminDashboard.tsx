
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader } from "lucide-react";

const AdminDashboard = () => {
  const { session, userRole, isLoading, signOut } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  useEffect(() => {
    const fetchCompanyData = async () => {
      if (session && userRole === 'admin') {
        try {
          const { data, error } = await supabase.functions.invoke('company-data', {
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          });
          
          if (error) {
            console.error("Function invocation error:", error);
            throw error;
          }
          
          console.log("Company data received:", data);
          setCompanies(data.companies || []);
        } catch (error) {
          console.error("Error fetching company data:", error);
        } finally {
          setLoadingCompanies(false);
        }
      }
    };

    fetchCompanyData();
  }, [session, userRole]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/admin/auth" />;
  }

  // If user is not admin, redirect to regular dashboard
  if (userRole !== 'admin') {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto p-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-[#1A1F2C]">ONE pay Admin</h1>
          <Button variant="outline" onClick={signOut}>
            Sair
          </Button>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h2 className="text-xl font-semibold mb-4">Painel Administrativo</h2>
          
          {loadingCompanies ? (
            <div className="flex justify-center my-10">
              <Loader className="h-8 w-8 animate-spin text-gray-500" />
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Todas as Empresas
                </h3>
              </div>
              
              {companies.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Nome
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          CNPJ
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Website
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {companies.map((company) => (
                        <tr key={company.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {company.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {company.cnpj}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {company.website ? (
                              <a 
                                href={company.website} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {company.website}
                              </a>
                            ) : (
                              "N/A"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-6 py-4 text-center text-gray-500">
                  Nenhuma empresa cadastrada.
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
