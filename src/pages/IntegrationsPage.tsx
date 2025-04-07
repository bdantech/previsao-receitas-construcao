import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";

interface ApiCredential {
  id: string;
  client_id: string;
  client_secret: string;
  active: boolean;
  created_at: string;
}

const IntegrationsPage = () => {
  const [credentials, setCredentials] = useState<ApiCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSecret, setShowSecret] = useState<{ [key: string]: boolean }>({});
  const { toast } = useToast();
  const { session } = useAuth();

  const getAuthHeaders = () => {
    if (!session?.access_token) {
      console.warn("No access token available");
      return {};
    }

    console.log("Using access token:", {
      length: session.access_token.length,
      exp: session.expires_at,
      user: session.user.id
    });

    return {
      Authorization: `Bearer ${session.access_token}`
    };
  };

  const fetchCredentials = async () => {
    try {
      if (!session) {
        throw new Error('No active session');
      }

      const headers = getAuthHeaders();
      if (!headers.Authorization) {
        throw new Error('No authorization header available');
      }

      const { data, error } = await supabase.functions.invoke('company-api-credentials', {
        method: 'GET',
        headers
      });

      if (error) {
        console.error("Error invoking function:", error);
        throw error;
      }

      setCredentials(data.credentials || []);
    } catch (error) {
      console.error('Error fetching credentials:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as credenciais",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateNewCredentials = async () => {
    try {
      if (!session) {
        throw new Error('No active session');
      }

      const headers = getAuthHeaders();
      if (!headers.Authorization) {
        throw new Error('No authorization header available');
      }

      const { data, error } = await supabase.functions.invoke('company-api-credentials', {
        body: { action: 'generate' },
        headers
      });

      if (error) {
        console.error("Error generating credentials:", error);
        throw error;
      }

      await fetchCredentials();
      toast({
        title: "Sucesso",
        description: "Novas credenciais geradas com sucesso",
      });
    } catch (error) {
      console.error('Error generating credentials:', error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar novas credenciais",
        variant: "destructive",
      });
    }
  };

  const deactivateCredential = async (credentialId: string) => {
    try {
      if (!session) {
        throw new Error('No active session');
      }

      const headers = getAuthHeaders();
      if (!headers.Authorization) {
        throw new Error('No authorization header available');
      }

      const { error } = await supabase.functions.invoke('company-api-credentials', {
        body: { action: 'deactivate', credentialId },
        headers
      });

      if (error) throw error;
      await fetchCredentials();
      toast({
        title: "Sucesso",
        description: "Credencial desativada com sucesso",
      });
    } catch (error) {
      console.error('Error deactivating credential:', error);
      toast({
        title: "Erro",
        description: "Não foi possível desativar a credencial",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado",
      description: "Texto copiado para a área de transferência",
    });
  };

  useEffect(() => {
    fetchCredentials();
  }, [session]);

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6">
        <h1 className="text-2xl font-bold mb-6">Integrações</h1>
        
        <Tabs defaultValue="credentials" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="credentials">Credenciais de Cliente</TabsTrigger>
            <TabsTrigger value="documentation">Documentação</TabsTrigger>
          </TabsList>
          
          <TabsContent value="credentials">
            <Card>
              <CardHeader>
                <CardTitle>Credenciais da API</CardTitle>
                <CardDescription>
                  Gerencie suas credenciais de acesso à API
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-end mb-4">
                  <Button onClick={generateNewCredentials}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Gerar Novas Credenciais
                  </Button>
                </div>

                {loading ? (
                  <div className="text-center py-4">Carregando...</div>
                ) : credentials.length === 0 ? (
                  <div className="text-center py-4">
                    Nenhuma credencial encontrada. Clique no botão acima para gerar novas credenciais.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {credentials.map((credential) => (
                      <Card key={credential.id}>
                        <CardContent className="pt-6">
                          <div className="grid gap-4">
                            <div className="flex items-center justify-between">
                              <Label>Client ID</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  value={credential.client_id}
                                  readOnly
                                  className="font-mono"
                                />
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => copyToClipboard(credential.client_id)}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <Label>Client Secret</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  type={showSecret[credential.id] ? "text" : "password"}
                                  value={credential.client_secret}
                                  readOnly
                                  className="font-mono"
                                />
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => setShowSecret(prev => ({
                                    ...prev,
                                    [credential.id]: !prev[credential.id]
                                  }))}
                                >
                                  {showSecret[credential.id] ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => copyToClipboard(credential.client_secret)}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-sm text-gray-500">
                                  Criado em: {new Date(credential.created_at).toLocaleDateString()}
                                </span>
                                <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                                  credential.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {credential.active ? 'Ativo' : 'Inativo'}
                                </span>
                              </div>
                              {credential.active && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => deactivateCredential(credential.id)}
                                >
                                  Desativar
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documentation">
            <Card>
              <CardHeader>
                <CardTitle>Documentação da API</CardTitle>
                <CardDescription>
                  Como integrar seu sistema com nossa API
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  <h2>Endpoint para Criação de Recebíveis</h2>
                  <p>
                    Utilize este endpoint para criar recebíveis via API:
                  </p>
                  <pre className="bg-gray-100 p-4 rounded-md">
                    <code>
                      POST https://hshfqxjrilqzjpkcotgz.supabase.co/functions/v1/project-receivables-api
                    </code>
                  </pre>

                  <h3>Autenticação</h3>
                  <p>
                    Todas as requisições devem incluir as credenciais no header:
                  </p>
                  <pre className="bg-gray-100 p-4 rounded-md">
                    <code>
                      Authorization: Basic {`Base64({client_id}:{client_secret})`}
                    </code>
                  </pre>

                  <h3>Exemplo de Requisição</h3>
                  <pre className="bg-gray-100 p-4 rounded-md">
                    <code>
                      {`{
  "project_id": "id_do_projeto",
  "receivables": [
    {
        "amount": 1000.00,
        "buyer_name": "Nome do Comprador",
        "buyer_cpf": "123.456.789-00",
        "due_date": "2024-12-31"
    }
  ]
}`}
                    </code>
                  </pre>

                  <h3>Resposta de Sucesso</h3>
                  <pre className="bg-gray-100 p-4 rounded-md">
                    <code>
                      {`{
    "success": true,
    "message": "1 recebíveis processados com sucesso",
    "processed": 1,
    "total": 1,
    "errors": null
}`}
                    </code>
                  </pre>

                  <h3>Códigos de Resposta</h3>
                  <ul>
                    <li><strong>200</strong> - Sucesso</li>
                    <li><strong>400</strong> - Dados inválidos</li>
                    <li><strong>401</strong> - Não autorizado</li>
                    <li><strong>403</strong> - Proibido</li>
                    <li><strong>500</strong> - Erro interno do servidor</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default IntegrationsPage;
