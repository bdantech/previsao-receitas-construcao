
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Loader } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentList } from "@/components/company/DocumentList";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const SettingsPage = () => {
  const { session, userRole, isLoading, getAuthHeader } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);
  
  useEffect(() => {
    const fetchUserCompany = async () => {
      if (!session?.access_token) return;
      
      try {
        setLoadingCompany(true);
        console.log('Fetching company data in Settings page');
        
        const { data, error } = await supabase.functions.invoke('company-data', {
          headers: getAuthHeader()
        });
        
        if (error) {
          console.error("Error fetching company data:", error);
          toast({
            title: "Erro",
            description: "Não foi possível carregar os dados da empresa",
            variant: "destructive",
          });
          throw error;
        }
        
        if (data.companies && data.companies.length > 0) {
          const companyData = data.companies[0];
          console.log("Company data loaded in settings:", companyData);
          setCompanyId(companyData.id);
        } else {
          console.log("No company found for user in settings");
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoadingCompany(false);
      }
    };

    fetchUserCompany();
  }, [session, getAuthHeader]);
  
  if (isLoading || loadingCompany) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" />;
  }

  if (userRole === 'admin') {
    return <Navigate to="/admin/dashboard" />;
  }
  
  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Configurações</h1>
        
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Documentos da Empresa</CardTitle>
            </CardHeader>
            <CardContent>
              {companyId ? (
                <DocumentList companyId={companyId} />
              ) : (
                <div className="text-center py-4 text-gray-500">
                  Nenhuma empresa encontrada
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Additional settings sections can be added here in the future */}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
