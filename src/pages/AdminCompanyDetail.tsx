
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminDashboardLayout } from "@/components/dashboard/AdminDashboardLayout";
import { CompanyDocuments } from "@/components/company/CompanyDocuments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminCompanyProjects } from "@/components/dashboard/AdminCompanyProjects";
import { useAuth } from "@/hooks/useAuth";
import { CompanyStatusBadge } from "@/components/company/CompanyStatusBadge";
import { formatCNPJ } from "@/lib/formatters";
import { AdminCompanyCredit } from "@/components/credit/AdminCompanyCredit";

const AdminCompanyDetail = () => {
  const { companyId } = useParams();
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { getAuthHeader } = useAuth();

  useEffect(() => {
    const fetchCompanyDetails = async () => {
      if (!companyId) return;
      
      try {
        setLoading(true);
        
        // Use the company-data edge function to get company details as admin
        const { data, error } = await supabase.functions.invoke('company-data', {
          method: 'POST',
          headers: await getAuthHeader(),
          body: {
            action: 'getCompanyDetails',
            companyId: companyId
          }
        });

        if (error) throw error;
        
        if (!data || !data.company) {
          throw new Error('Company data not returned from server');
        }
        
        setCompany(data.company);
      } catch (error: any) {
        console.error("Error fetching company details:", error);
        toast({
          title: "Error",
          description: "Failed to load company details: " + error.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (companyId) {
      fetchCompanyDetails();
    }
  }, [companyId, toast, getAuthHeader]);

  if (loading) {
    return (
      <AdminDashboardLayout>
        <div className="space-y-4">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-[200px] w-full" />
        </div>
      </AdminDashboardLayout>
    );
  }

  if (!company) {
    return (
      <AdminDashboardLayout>
        <div className="p-6 text-center">
          <h2 className="text-2xl font-bold">Company not found</h2>
          <p className="text-muted-foreground">
            The company you're looking for doesn't exist or you don't have
            permission to view it.
          </p>
        </div>
      </AdminDashboardLayout>
    );
  }

  return (
    <AdminDashboardLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{company?.name}</h1>
        
        <Card>
          <CardHeader>
            <CardTitle>Detalhes da Empresa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">CNPJ</p>
                <p>{formatCNPJ(company?.cnpj)}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Website</p>
                <p>{company?.website || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Status dos Documentos</p>
                <CompanyStatusBadge status={company?.documents_status} />
              </div>
            </div>
          </CardContent>
        </Card>

        {company && (
          <Tabs defaultValue="documents">
            <TabsList>
              <TabsTrigger value="documents">Documentos</TabsTrigger>
              <TabsTrigger value="projects">Projetos</TabsTrigger>
              <TabsTrigger value="credit">Análise de Crédito</TabsTrigger>
            </TabsList>
            <TabsContent value="documents">
              <CompanyDocuments companyId={companyId!} />
            </TabsContent>
            <TabsContent value="projects">
              <AdminCompanyProjects companyId={companyId!} companyName={company.name} />
            </TabsContent>
            <TabsContent value="credit">
              <AdminCompanyCredit companyId={companyId!} companyName={company.name} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AdminDashboardLayout>
  );
};

export default AdminCompanyDetail;
