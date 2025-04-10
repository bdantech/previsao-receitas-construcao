
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatCNPJ } from "@/lib/formatters";
import { ArrowRight, Loader } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

const AdminDashboard = () => {
  const { session, userRole, isLoading } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCompanyData = async () => {
      if (session && userRole === 'admin') {
        try {
          setLoadingCompanies(true);
          console.log("Fetching company data with token:", session.access_token.substring(0, 10) + "...");
          
          const { data, error } = await supabase.functions.invoke('company-data', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`
            },
            body: {} // Empty body for default admin action (fetch all companies)
          });
          
          if (error) {
            console.error("Function invocation error:", error);
            toast({
              title: "Error",
              description: "Failed to fetch company data. Please try again.",
              variant: "destructive"
            });
            throw error;
          }
          
          console.log("Company data received:", data);
          if (data && data.companies) {
            setCompanies(data.companies);
          } else {
            console.error("Unexpected response format:", data);
            toast({
              title: "Error",
              description: "Received invalid data format from server.",
              variant: "destructive"
            });
          }
        } catch (error) {
          console.error("Error fetching company data:", error);
        } finally {
          setLoadingCompanies(false);
        }
      } else if (!isLoading) {
        // If authentication is complete but not admin or not logged in
        setLoadingCompanies(false);
      }
    };

    fetchCompanyData();
  }, [session, userRole, isLoading]);

  const handleViewCompany = (companyId: string) => {
    navigate(`/admin/companies/${companyId}`);
  };

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
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Painel Administrativo</h2>
      </div>
      
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
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {companies.map((company) => (
                    <tr 
                      key={company.id} 
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {company.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCNPJ(company.cnpj)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {company.website ? (
                          <a 
                            href={company.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {company.website}
                          </a>
                        ) : (
                          "N/A"
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewCompany(company.id)}
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
              Nenhuma empresa cadastrada.
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default AdminDashboard;
