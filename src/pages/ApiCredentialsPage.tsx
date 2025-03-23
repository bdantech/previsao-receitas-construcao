
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Copy, RefreshCw, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import PageContainer from "@/components/layout/PageContainer";
import HeaderWithButtons from "@/components/layout/HeaderWithButtons";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import AdminDashboardLayout from "@/components/dashboard/AdminDashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

type ApiCredential = {
  id: string;
  client_id: string;
  client_secret?: string;
  active: boolean;
  created_at: string;
  company_id: string;
};

const ApiCredentialsPage = () => {
  const { user, userRole, getAuthHeader } = useAuth();
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState<ApiCredential[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewCredentialDialog, setShowNewCredentialDialog] = useState(false);
  const [newCredential, setNewCredential] = useState<ApiCredential | null>(null);
  
  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    
    setIsAdmin(userRole === "admin");
    
    const loadInitialData = async () => {
      try {
        if (userRole === "admin") {
          // For admins, get all companies
          const { data: companiesData, error: companiesError } = await supabase
            .from("companies")
            .select("*")
            .order("name");
            
          if (companiesError) throw companiesError;
          setCompanies(companiesData || []);
          
          if (companiesData && companiesData.length > 0) {
            setSelectedCompanyId(companiesData[0].id);
          }
        } else {
          // For company users, get their company
          const { data: userCompanyData, error: userCompanyError } = await supabase
            .from("user_companies")
            .select("company_id, companies:company_id(id, name)")
            .eq("user_id", user.id)
            .single();
            
          if (userCompanyError) throw userCompanyError;
          
          if (userCompanyData?.company_id) {
            setSelectedCompanyId(userCompanyData.company_id);
            setCompanies([userCompanyData.companies]);
          }
        }
      } catch (error) {
        console.error("Error loading initial data:", error);
        toast.error("Failed to load company data");
      } finally {
        setIsLoading(false);
      }
    };
    
    loadInitialData();
  }, [user, userRole, navigate]);
  
  useEffect(() => {
    const loadCredentials = async () => {
      if (!selectedCompanyId) return;
      
      setIsLoading(true);
      try {
        const headers = await getAuthHeader();
        
        const { data, error } = await supabase.functions.invoke('company-api-credentials', {
          headers,
          body: {
            action: 'getCredentials',
            companyId: selectedCompanyId
          }
        });
        
        if (error) throw error;
        
        setCredentials(data?.credentials || []);
      } catch (error) {
        console.error("Error loading credentials:", error);
        toast.error("Failed to load API credentials");
      } finally {
        setIsLoading(false);
      }
    };
    
    if (selectedCompanyId) {
      loadCredentials();
    }
  }, [selectedCompanyId, getAuthHeader]);
  
  const handleGenerateCredentials = async () => {
    if (!selectedCompanyId) {
      toast.error("No company selected");
      return;
    }
    
    try {
      setIsLoading(true);
      const headers = await getAuthHeader();
      
      const { data, error } = await supabase.functions.invoke('company-api-credentials', {
        headers,
        body: {
          action: 'generateCredentials',
          companyId: selectedCompanyId
        }
      });
      
      if (error) throw error;
      
      if (data?.credential) {
        setNewCredential(data.credential);
        setShowNewCredentialDialog(true);
        
        // Refresh the credentials list
        const { data: refreshData, error: refreshError } = await supabase.functions.invoke('company-api-credentials', {
          headers,
          body: {
            action: 'getCredentials',
            companyId: selectedCompanyId
          }
        });
        
        if (!refreshError) {
          setCredentials(refreshData?.credentials || []);
        }
      }
    } catch (error) {
      console.error("Error generating credentials:", error);
      toast.error("Failed to generate new API credentials");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeactivateCredential = async (credentialId: string) => {
    if (!selectedCompanyId) return;
    
    try {
      setIsLoading(true);
      const headers = await getAuthHeader();
      
      const { data, error } = await supabase.functions.invoke('company-api-credentials', {
        headers,
        body: {
          action: 'deactivateCredentials',
          companyId: selectedCompanyId,
          credentialId
        }
      });
      
      if (error) throw error;
      
      toast.success("API credential deactivated successfully");
      
      // Update local state
      setCredentials(prevCreds => 
        prevCreds.map(cred => 
          cred.id === credentialId ? { ...cred, active: false } : cred
        )
      );
    } catch (error) {
      console.error("Error deactivating credential:", error);
      toast.error("Failed to deactivate API credential");
    } finally {
      setIsLoading(false);
    }
  };
  
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
      .then(() => toast.success(`${label} copied to clipboard`))
      .catch(() => toast.error("Failed to copy to clipboard"));
  };

  const handleCompanyChange = (companyId: string) => {
    setSelectedCompanyId(companyId);
  };
  
  return (
    <>
      {isAdmin ? (
        <AdminDashboardLayout>
          <ApiCredentialsContent 
            isAdmin={isAdmin}
            isLoading={isLoading}
            companies={companies}
            selectedCompanyId={selectedCompanyId}
            credentials={credentials}
            handleCompanyChange={handleCompanyChange}
            handleGenerateCredentials={handleGenerateCredentials}
            handleDeactivateCredential={handleDeactivateCredential}
            copyToClipboard={copyToClipboard}
          />
        </AdminDashboardLayout>
      ) : (
        <DashboardLayout>
          <ApiCredentialsContent 
            isAdmin={isAdmin}
            isLoading={isLoading}
            companies={companies}
            selectedCompanyId={selectedCompanyId}
            credentials={credentials}
            handleCompanyChange={handleCompanyChange}
            handleGenerateCredentials={handleGenerateCredentials}
            handleDeactivateCredential={handleDeactivateCredential}
            copyToClipboard={copyToClipboard}
          />
        </DashboardLayout>
      )}
      
      {/* New Credential Dialog */}
      <Dialog open={showNewCredentialDialog} onOpenChange={setShowNewCredentialDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New API Credentials Generated</DialogTitle>
            <DialogDescription>
              Please save these credentials securely. The client secret will only be shown once.
            </DialogDescription>
          </DialogHeader>
          
          {newCredential && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client_id">Client ID</Label>
                <div className="flex items-center space-x-2">
                  <Input 
                    id="client_id" 
                    value={newCredential.client_id} 
                    readOnly 
                    className="bg-muted"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(newCredential.client_id, "Client ID")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="client_secret">Client Secret</Label>
                <div className="flex items-center space-x-2">
                  <Input 
                    id="client_secret" 
                    value={newCredential.client_secret || ''} 
                    readOnly 
                    className="bg-muted"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(newCredential.client_secret || '', "Client Secret")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="rounded-md bg-amber-50 p-4 border border-amber-200">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-amber-800">Important</h3>
                    <div className="mt-2 text-sm text-amber-700">
                      <p>
                        This is the only time the client secret will be shown. Please save it somewhere secure.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setShowNewCredentialDialog(false)}>
              I've Saved These Credentials
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Separate component for the content to avoid duplication
const ApiCredentialsContent = ({
  isAdmin,
  isLoading,
  companies,
  selectedCompanyId,
  credentials,
  handleCompanyChange,
  handleGenerateCredentials,
  handleDeactivateCredential,
  copyToClipboard
}: {
  isAdmin: boolean;
  isLoading: boolean;
  companies: any[];
  selectedCompanyId: string | null;
  credentials: ApiCredential[];
  handleCompanyChange: (companyId: string) => void;
  handleGenerateCredentials: () => void;
  handleDeactivateCredential: (credentialId: string) => void;
  copyToClipboard: (text: string, label: string) => void;
}) => {
  return (
    <PageContainer>
      <HeaderWithButtons
        title="API Credentials"
        description="Manage API credentials for your company's integration"
        loading={isLoading}
      >
        <Button onClick={handleGenerateCredentials}>
          Generate New Credentials
        </Button>
      </HeaderWithButtons>
      
      {isAdmin && companies.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select Company</CardTitle>
            <CardDescription>Choose the company to manage API credentials</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs 
              defaultValue={selectedCompanyId || companies[0]?.id} 
              onValueChange={handleCompanyChange}
              className="w-full"
            >
              <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
                {companies.map(company => (
                  <TabsTrigger key={company.id} value={company.id}>
                    {company.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle>API Credentials</CardTitle>
          <CardDescription>
            Use these credentials to authenticate your API requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {credentials.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {credentials.map(credential => (
                  <TableRow key={credential.id}>
                    <TableCell className="font-mono">
                      <div className="flex items-center space-x-2">
                        <span className="truncate max-w-[200px]">{credential.client_id}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(credential.client_id, "Client ID")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={credential.active ? "default" : "secondary"}>
                        {credential.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(credential.created_at), "PPP")}
                    </TableCell>
                    <TableCell className="text-right">
                      {credential.active && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeactivateCredential(credential.id)}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Deactivate
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No API credentials found</p>
              <Button onClick={handleGenerateCredentials} className="mt-4">
                Generate New Credentials
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="text-sm text-muted-foreground">
            {credentials.filter(c => c.active).length} active credentials
          </div>
        </CardFooter>
      </Card>
    </PageContainer>
  );
};

export default ApiCredentialsPage;
