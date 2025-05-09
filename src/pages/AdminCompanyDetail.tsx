import { CompanyDocuments } from "@/components/company/CompanyDocuments";
import { CompanyStatusBadge } from "@/components/company/CompanyStatusBadge";
import { AdminCompanyCredit } from "@/components/credit/AdminCompanyCredit";
import { AdminCompanyProjects } from "@/components/dashboard/AdminCompanyProjects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatCNPJ } from "@/lib/formatters";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

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
      <>
        <div className="space-y-4">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-[200px] w-full" />
        </div>
      </>
    );
  }

  if (!company) {
    return (
      <>
        <div className="p-6 text-center">
          <h2 className="text-2xl font-bold">Company not found</h2>
          <p className="text-muted-foreground">
            The company you're looking for doesn't exist or you don't have
            permission to view it.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
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
              <CompanyDocuments companyId={companyId!} isAdmin={true} />
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
    </>
  );
};

export default AdminCompanyDetail;
