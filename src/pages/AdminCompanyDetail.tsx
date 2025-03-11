
import { useEffect, useState } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader, ArrowLeft, Globe, Building, FileText, Clock } from "lucide-react";
import { AdminDashboardLayout } from "@/components/dashboard/AdminDashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Define interface for company type
interface Company {
  id: string;
  name: string;
  cnpj: string;
  website?: string;
  documents_status: 'pending' | 'approved';
  created_at: string;
}

const AdminCompanyDetail = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const { session, userRole, isLoading } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCompanyDetails = async () => {
      if (session && userRole === 'admin' && companyId) {
        try {
          setIsLoading(true);
          
          const { data, error } = await supabase.functions.invoke('company-data', {
            headers: {
              Authorization: `Bearer ${session.access_token}`
            },
            body: {
              action: 'getCompanyDetails',
              companyId
            }
          });
          
          if (error) {
            console.error("Function invocation error:", error);
            throw error;
          }
          
          console.log("Company details received:", data);
          if (data.company) {
            setCompany(data.company);
          }
        } catch (error) {
          console.error("Error fetching company details:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchCompanyDetails();
  }, [session, userRole, companyId]);

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <AdminDashboardLayout>
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/admin/dashboard')}
          className="mb-4 flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Lista de Empresas
        </Button>
        
        <div className="flex justify-between items-start">
          <h2 className="text-2xl font-bold text-gray-900">
            {company?.name || 'Detalhes da Empresa'}
          </h2>
          <Badge variant={company?.documents_status === 'approved' ? 'success' : 'default'}>
            {company?.documents_status === 'approved' ? 'Documentos Aprovados' : 'Documentos Pendentes'}
          </Badge>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center my-10">
          <Loader className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      ) : !company ? (
        <div className="bg-white shadow sm:rounded-lg p-6 text-center text-gray-500">
          Empresa não encontrada ou você não tem permissão para visualizá-la.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Company Information Card */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
                <Building className="mr-2 h-5 w-5 text-gray-500" />
                Informações da Empresa
              </h3>
            </div>
            <div className="border-t border-gray-200">
              <dl>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Nome da Empresa</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{company.name}</dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">CNPJ</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{company.cnpj}</dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Website</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {company.website ? (
                      <a 
                        href={company.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center"
                      >
                        <Globe className="mr-1 h-4 w-4" />
                        {company.website}
                      </a>
                    ) : 'Não informado'}
                  </dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Status dos Documentos</dt>
                  <dd className="mt-1 text-sm sm:mt-0 sm:col-span-2">
                    <Badge variant={company.documents_status === 'approved' ? 'success' : 'default'}>
                      {company.documents_status === 'approved' ? 'Aprovados' : 'Pendentes'}
                    </Badge>
                  </dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Data de Cadastro</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 flex items-center">
                    <Clock className="mr-1 h-4 w-4 text-gray-500" />
                    {company.created_at ? formatDate(company.created_at) : 'Não disponível'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
          
          {/* Documents Section - Placeholder for future implementation */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
                <FileText className="mr-2 h-5 w-5 text-gray-500" />
                Documentos da Empresa
              </h3>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
              <p className="text-gray-500 text-center py-6">
                A visualização detalhada de documentos será implementada em breve.
              </p>
            </div>
          </div>
        </div>
      )}
    </AdminDashboardLayout>
  );
};

export default AdminCompanyDetail;
