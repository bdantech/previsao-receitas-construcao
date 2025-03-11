
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Loader, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CompanyDocuments } from "@/components/company/CompanyDocuments";

interface Company {
  id: string;
  name: string;
  cnpj: string;
  website?: string | null;
}

const CompanyPage = () => {
  const { session, userRole, isLoading } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    website: ""
  });

  useEffect(() => {
    const fetchCompanyData = async () => {
      if (session?.access_token) {
        try {
          setLoading(true);
          console.log('Fetching company data for edit page');
          
          const { data, error } = await supabase.functions.invoke('company-data', {
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
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
            console.log("Company data loaded:", companyData);
            setCompany(companyData);
            setFormData({
              name: companyData.name,
              website: companyData.website || ""
            });
          } else {
            console.log("No company found for user");
          }
        } catch (error) {
          console.error("Error:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchCompanyData();
  }, [session]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!company) return;
    
    setUpdating(true);
    
    try {
      console.log("Updating company:", formData);
      
      const { data, error } = await supabase.functions.invoke('update-company', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        },
        body: {
          companyId: company.id,
          updates: {
            name: formData.name,
            website: formData.website || null
          }
        }
      });
      
      if (error) {
        console.error("Error updating company:", error);
        toast({
          title: "Erro",
          description: "Não foi possível atualizar os dados da empresa",
          variant: "destructive",
        });
        throw error;
      }
      
      console.log("Company updated:", data);
      setCompany({
        ...company,
        name: formData.name,
        website: formData.website
      });
      
      toast({
        title: "Sucesso",
        description: "Dados da empresa atualizados com sucesso",
      });
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setUpdating(false);
    }
  };
  
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

  if (userRole === 'admin') {
    return <Navigate to="/admin/dashboard" />;
  }
  
  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Minha Empresa</h1>
          <p className="text-gray-500 mt-1">Gerencie os dados da sua empresa</p>
        </div>
        
        {loading ? (
          <div className="flex justify-center my-10">
            <Loader className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        ) : company ? (
          <div>
            <div className="bg-white shadow rounded-lg p-6 max-w-2xl">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Empresa</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Nome da empresa"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={company.cnpj}
                    readOnly
                    className="bg-gray-50"
                  />
                  <p className="text-sm text-gray-500">O CNPJ não pode ser alterado</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="website">Website (opcional)</Label>
                  <Input
                    id="website"
                    name="website"
                    value={formData.website}
                    onChange={handleInputChange}
                    placeholder="https://www.empresa.com.br"
                  />
                </div>
                
                <Button 
                  type="submit" 
                  disabled={updating}
                  className="w-full sm:w-auto"
                >
                  {updating ? (
                    <>
                      <Loader className="h-4 w-4 mr-2 animate-spin" />
                      Atualizando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Alterações
                    </>
                  )}
                </Button>
              </form>
            </div>
            
            {company && <CompanyDocuments companyId={company.id} />}
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

export default CompanyPage;
