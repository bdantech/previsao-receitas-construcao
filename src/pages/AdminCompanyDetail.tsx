
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

const AdminCompanyDetail = () => {
  const { companyId } = useParams();
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchCompanyDetails = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("companies")
          .select("*")
          .eq("id", companyId)
          .single();

        if (error) throw error;
        setCompany(data);
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
  }, [companyId, toast]);

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
        <h1 className="text-2xl font-bold">{company.name}</h1>
        
        <Card>
          <CardHeader>
            <CardTitle>Company Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">CNPJ</p>
                <p>{company.cnpj}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Website</p>
                <p>{company.website || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Documents Status</p>
                <p>{company.documents_status}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="documents">
          <TabsList>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
          </TabsList>
          <TabsContent value="documents">
            <CompanyDocuments companyId={companyId!} />
          </TabsContent>
          <TabsContent value="projects">
            <AdminCompanyProjects companyId={companyId!} companyName={company.name} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminDashboardLayout>
  );
};

export default AdminCompanyDetail;
