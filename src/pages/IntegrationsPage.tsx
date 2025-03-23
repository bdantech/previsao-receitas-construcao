
import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { AlertCircle, CheckCircle, Copy, Key, RefreshCw, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import { useAuth } from "@/hooks/useAuth";

interface ApiCredential {
  id: string;
  client_id: string;
  client_secret: string;
  active: boolean;
  created_at: string;
}

const IntegrationsPage = () => {
  const { toast } = useToast();
  const { getAuthHeader } = useAuth();
  const [loading, setLoading] = useState(true);
  const [credentials, setCredentials] = useState<ApiCredential[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // API endpoint URL
  const apiEndpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/project-receivables-api`;
  
  // Function to load credentials
  const loadCredentials = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('company-api-credentials', {
        method: 'GET',
        headers: getAuthHeader()
      });

      if (error) {
        console.error("Error loading credentials:", error);
        setError("Erro ao carregar credenciais. Por favor, tente novamente.");
      } else {
        setCredentials(data.credentials || []);
      }
    } catch (err) {
      console.error("Exception loading credentials:", err);
      setError("Erro ao carregar credenciais. Por favor, tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Load credentials on component mount
  useEffect(() => {
    loadCredentials();
  }, []);

  // Function to generate new credentials
  const handleGenerateCredentials = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('company-api-credentials', {
        method: 'POST',
        body: { action: 'generate' },
        headers: getAuthHeader()
      });

      if (error) {
        console.error("Error generating credentials:", error);
        setError("Erro ao gerar novas credenciais. Por favor, tente novamente.");
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Falha ao gerar novas credenciais.",
        });
      } else {
        // Refresh credentials list
        await loadCredentials();
        toast({
          title: "Sucesso",
          description: "Novas credenciais API geradas com sucesso.",
        });
      }
    } catch (err) {
      console.error("Exception generating credentials:", err);
      setError("Erro ao gerar novas credenciais. Por favor, tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Function to deactivate credentials
  const handleDeactivateCredentials = async (credentialId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('company-api-credentials', {
        method: 'POST',
        body: { action: 'deactivate', credentialId },
        headers: getAuthHeader()
      });

      if (error) {
        console.error("Error deactivating credentials:", error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Falha ao desativar credenciais.",
        });
      } else {
        // Refresh credentials list
        await loadCredentials();
        toast({
          title: "Sucesso",
          description: "Credenciais desativadas com sucesso.",
        });
      }
    } catch (err) {
      console.error("Exception deactivating credentials:", err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao desativar credenciais.",
      });
    }
  };

  // Function to copy text to clipboard
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        toast({
          title: "Copiado!",
          description: `${label} copiado para a área de transferência.`,
        });
      },
      (err) => {
        console.error("Erro ao copiar:", err);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Falha ao copiar para a área de transferência.",
        });
      }
    );
  };

  // Get active credentials if any
  const activeCredentials = credentials.find(cred => cred.active);

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Integrações API</h1>
        </div>

        <Tabs defaultValue="api-keys">
          <TabsList className="mb-4">
            <TabsTrigger value="api-keys">Credenciais API</TabsTrigger>
            <TabsTrigger value="docs">Documentação</TabsTrigger>
          </TabsList>

          <TabsContent value="api-keys">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Credenciais de API
                  </CardTitle>
                  <CardDescription>
                    Gerencie as credenciais para integração com a API de recebíveis.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {error && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Erro</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="mb-6 flex justify-end">
                    <Button 
                      onClick={handleGenerateCredentials} 
                      disabled={isGenerating}
                      className="flex items-center gap-2"
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Gerando...
                        </>
                      ) : (
                        <>
                          <Key className="h-4 w-4" />
                          Gerar Novas Credenciais
                        </>
                      )}
                    </Button>
                  </div>

                  {activeCredentials && (
                    <Alert className="mb-6">
                      <CheckCircle className="h-4 w-4" />
                      <AlertTitle>Credenciais Ativas</AlertTitle>
                      <AlertDescription>
                        Você tem credenciais ativas que podem ser usadas para integração.
                      </AlertDescription>
                    </Alert>
                  )}

                  {loading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : credentials.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID do Cliente</TableHead>
                          <TableHead>Chave Secreta</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Data de Criação</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {credentials.map((cred) => (
                          <TableRow key={cred.id}>
                            <TableCell className="font-mono">
                              <div className="flex items-center gap-2">
                                {cred.client_id}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => copyToClipboard(cred.client_id, "Client ID")}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono">
                              <div className="flex items-center gap-2">
                                {cred.client_secret.substring(0, 8)}...
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => copyToClipboard(cred.client_secret, "Client Secret")}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                cred.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                              }`}>
                                {cred.active ? "Ativo" : "Inativo"}
                              </span>
                            </TableCell>
                            <TableCell>
                              {new Date(cred.created_at).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell>
                              {cred.active && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeactivateCredentials(cred.id)}
                                >
                                  Desativar
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8">
                      <Shield className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium">Nenhuma credencial encontrada</h3>
                      <p className="text-gray-500 mb-4">
                        Você ainda não tem credenciais de API. Gere um novo par de chaves para começar.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="docs">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Documentação da API de Recebíveis</CardTitle>
                  <CardDescription>
                    Instruções para integrar com a API de recebíveis do OnePay
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-2">Endpoint</h3>
                    <div className="bg-slate-100 p-3 rounded-md flex justify-between items-center">
                      <code className="font-mono text-sm">{apiEndpoint}</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(apiEndpoint, "Endpoint")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-2">Autenticação</h3>
                    <p className="mb-2">A API utiliza autenticação Basic Auth:</p>
                    <ol className="list-decimal list-inside space-y-1 mb-4 pl-4">
                      <li>Use seu <strong>Client ID</strong> como nome de usuário</li>
                      <li>Use seu <strong>Client Secret</strong> como senha</li>
                      <li>Codifique estas credenciais em Base64 no formato <code>client_id:client_secret</code></li>
                      <li>Adicione o header <code>Authorization: Basic {'{base64_encoded_credentials}'}</code></li>
                    </ol>
                    <div className="bg-slate-100 p-3 rounded-md">
                      <pre className="font-mono text-sm whitespace-pre-wrap">
{`// Exemplo de header de autenticação
Authorization: Basic ZXhhbXBsZV9jbGllbnRfaWQ6ZXhhbXBsZV9jbGllbnRfc2VjcmV0`}
                      </pre>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-2">Criação de Recebíveis</h3>
                    <p className="mb-2">Endpoint para enviar novos recebíveis:</p>
                    <div className="bg-slate-100 p-3 rounded-md mb-4">
                      <pre className="font-mono text-sm">POST {apiEndpoint}</pre>
                    </div>

                    <h4 className="font-medium mb-2">Exemplo de Payload:</h4>
                    <div className="bg-slate-100 p-3 rounded-md mb-4">
                      <pre className="font-mono text-sm whitespace-pre-wrap">
{`{
  "project_id": "uuid-do-projeto",
  "receivables": [
    {
      "buyer_name": "Nome do Comprador",
      "buyer_cpf": "123.456.789-00",
      "amount": 1000.50,
      "due_date": "2023-12-31",
      "description": "Parcela 1/12",
      "external_id": "ID-EXTERNO-001"
    },
    {
      "buyer_name": "Outro Comprador",
      "buyer_cpf": "987.654.321-00",
      "amount": 2500.75,
      "due_date": "2024-01-15",
      "description": "Parcela 1/24",
      "external_id": "ID-EXTERNO-002"
    }
  ]
}`}
                      </pre>
                    </div>

                    <h4 className="font-medium mb-2">Campos obrigatórios:</h4>
                    <ul className="list-disc list-inside space-y-1 mb-4 pl-4">
                      <li><strong>project_id</strong>: UUID do projeto</li>
                      <li><strong>receivables</strong>: Array de recebíveis</li>
                      <li><strong>buyer_name</strong>: Nome do comprador</li>
                      <li><strong>buyer_cpf</strong>: CPF do comprador</li>
                      <li><strong>amount</strong>: Valor do recebível</li>
                      <li><strong>due_date</strong>: Data de vencimento (formato YYYY-MM-DD)</li>
                    </ul>

                    <h4 className="font-medium mb-2">Campos opcionais:</h4>
                    <ul className="list-disc list-inside space-y-1 mb-4 pl-4">
                      <li><strong>description</strong>: Descrição do recebível</li>
                      <li><strong>external_id</strong>: ID externo para referência</li>
                    </ul>

                    <h4 className="font-medium mb-2">Exemplo de Resposta:</h4>
                    <div className="bg-slate-100 p-3 rounded-md">
                      <pre className="font-mono text-sm whitespace-pre-wrap">
{`{
  "success": true,
  "message": "2 recebíveis processados com sucesso",
  "processed": 2,
  "total": 2,
  "errors": null
}`}
                      </pre>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default IntegrationsPage;
