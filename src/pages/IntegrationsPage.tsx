
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  ChevronRight, 
  Code, 
  Copy, 
  ExternalLink, 
  Key, 
  Lock, 
  RefreshCw, 
  Shield 
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import PageContainer from "@/components/layout/PageContainer";
import HeaderWithButtons from "@/components/layout/HeaderWithButtons";

interface ApiCredential {
  id: string;
  client_id: string;
  client_secret?: string;
  active: boolean;
  created_at: string;
  created_by: string;
}

const IntegrationsPage = () => {
  const { toast } = useToast();
  const { session } = useAuth();
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<ApiCredential[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [newCredential, setNewCredential] = useState<ApiCredential | null>(null);
  
  // Fetch company ID and API credentials
  useEffect(() => {
    const fetchData = async () => {
      if (!session) {
        navigate("/auth");
        return;
      }
      
      try {
        setIsLoading(true);
        
        // Get user's company
        const { data: userCompany } = await supabase.functions.invoke('project-management', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: {
            method: 'GET',
            endpoint: 'user-company'
          }
        });
        
        if (userCompany?.companyId) {
          setCompanyId(userCompany.companyId);
          
          // Get company API credentials
          const response = await supabase.functions.invoke('company-api-credentials', {
            headers: {
              Authorization: `Bearer ${session.access_token}`
            },
            body: {
              action: 'getCredentials',
              companyId: userCompany.companyId
            }
          });
          
          if (response.error) {
            throw response.error;
          }
          
          setCredentials(response.data?.credentials || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: "Erro ao carregar dados da integração",
          description: "Não foi possível obter informações da empresa ou credenciais de API.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [session, navigate, toast]);
  
  // Handle generating new API credentials
  const handleGenerateCredentials = async () => {
    if (!companyId || !session) return;
    
    setShowConfirmDialog(false);
    
    try {
      setIsGenerating(true);
      
      const response = await supabase.functions.invoke('company-api-credentials', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          action: 'generateCredentials',
          companyId: companyId
        }
      });
      
      if (response.error) {
        throw response.error;
      }
      
      // Update credentials list
      const credential = response.data?.credential;
      if (credential) {
        setNewCredential(credential);
        setShowCredentialsDialog(true);
        
        // Update active state in the list
        setCredentials(prev => 
          [credential, ...prev.map(c => ({ ...c, active: false }))]
        );
      }
      
      toast({
        title: "Credenciais geradas com sucesso",
        description: "Novas credenciais de API foram geradas. Guarde-as em um local seguro.",
      });
    } catch (error) {
      console.error('Error generating credentials:', error);
      toast({
        title: "Erro ao gerar credenciais",
        description: "Não foi possível gerar novas credenciais de API.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Copy text to clipboard
  const copyToClipboard = (text: string, successMessage: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: successMessage,
    });
  };
  
  const hasActiveCredential = credentials.some(cred => cred.active);
  
  return (
    <PageContainer>
      <HeaderWithButtons
        title="Integrações"
        description="Gerencie as integrações de API para o seu sistema"
        loading={isLoading}
      />
      
      <Tabs defaultValue="credentials" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="credentials">Credenciais de API</TabsTrigger>
          <TabsTrigger value="docs">Documentação</TabsTrigger>
        </TabsList>
        
        <TabsContent value="credentials">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="mr-2 h-5 w-5" />
                  Credenciais de API
                </CardTitle>
                <CardDescription>
                  Gerencie as credenciais de acesso para integrações via API
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-6">
                  <Lock className="h-4 w-4" />
                  <AlertTitle>Importante sobre segurança</AlertTitle>
                  <AlertDescription>
                    As credenciais dão acesso à sua API. Guarde-as com segurança e nunca compartilhe
                    o Client Secret. Ao gerar novas credenciais, as anteriores serão desativadas.
                  </AlertDescription>
                </Alert>
                
                <Button 
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={isGenerating || isLoading}
                  className="mb-6"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Key className="mr-2 h-4 w-4" />
                      Gerar Novas Credenciais
                    </>
                  )}
                </Button>
                
                <div className="border rounded-md divide-y">
                  <div className="bg-gray-50 px-4 py-3 text-sm font-medium flex justify-between">
                    <div>Credenciais</div>
                    <div>Status</div>
                  </div>
                  
                  {credentials.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-500">
                      Nenhuma credencial gerada. Clique em "Gerar Novas Credenciais" para começar.
                    </div>
                  ) : (
                    credentials.map((credential) => (
                      <div key={credential.id} className="px-4 py-3 flex justify-between items-center">
                        <div>
                          <div className="font-medium">
                            {credential.client_id}
                          </div>
                          <div className="text-sm text-gray-500">
                            Criada em {format(new Date(credential.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </div>
                        </div>
                        <div>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            credential.active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {credential.active ? 'Ativa' : 'Inativa'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="docs">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Code className="mr-2 h-5 w-5" />
                  Documentação da API
                </CardTitle>
                <CardDescription>
                  Instruções para integração da API de recebíveis do projeto
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-2">Autenticação</h3>
                  <div className="text-sm text-gray-600 mb-4">
                    A API utiliza autenticação Basic Auth. Codifique sua chave no formato base64(client_id:client_secret)
                    e inclua-a no cabeçalho da requisição.
                  </div>
                  <div className="bg-slate-950 text-white p-4 rounded-md overflow-x-auto text-sm mb-2">
                    <div className="font-mono">
                      <span className="text-blue-400">Authorization</span>: Basic <span className="text-yellow-300">base64(client_id:client_secret)</span>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex items-center"
                    onClick={() => copyToClipboard(
                      "Authorization: Basic base64(client_id:client_secret)",
                      "Formato do header copiado!"
                    )}
                  >
                    <Copy className="mr-1 h-3 w-3" />
                    Copiar
                  </Button>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-2">Endpoint para Recebíveis</h3>
                  <div className="text-sm text-gray-600 mb-4">
                    Utilize este endpoint para criar recebíveis em um projeto específico.
                  </div>
                  <div className="bg-slate-950 text-white p-4 rounded-md overflow-x-auto text-sm mb-2">
                    <div className="font-mono">
                      <span className="text-purple-400">POST</span> {window.location.origin}/functions/project-receivables-api
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex items-center"
                    onClick={() => copyToClipboard(
                      `${window.location.origin}/functions/project-receivables-api`,
                      "Endpoint copiado!"
                    )}
                  >
                    <Copy className="mr-1 h-3 w-3" />
                    Copiar Endpoint
                  </Button>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-2">Exemplo de Payload</h3>
                  <div className="text-sm text-gray-600 mb-4">
                    Exemplo de JSON para criar múltiplos recebíveis.
                  </div>
                  <div className="bg-slate-950 text-white p-4 rounded-md overflow-x-auto text-sm font-mono mb-2">
                    {`{
  "projectId": "uuid-do-projeto",
  "receivables": [
    {
      "buyerName": "Nome do Comprador",
      "buyerCpf": "123.456.789-00",
      "amount": 1000.00,
      "dueDate": "2024-12-31",
      "description": "Descrição do recebível (opcional)"
    },
    {
      "buyerName": "Nome do Comprador 2",
      "buyerCpf": "987.654.321-00",
      "amount": 2500.50,
      "dueDate": "2024-11-15"
    }
  ]
}`}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex items-center"
                    onClick={() => copyToClipboard(
                      `{
  "projectId": "uuid-do-projeto",
  "receivables": [
    {
      "buyerName": "Nome do Comprador",
      "buyerCpf": "123.456.789-00",
      "amount": 1000.00,
      "dueDate": "2024-12-31",
      "description": "Descrição do recebível (opcional)"
    },
    {
      "buyerName": "Nome do Comprador 2",
      "buyerCpf": "987.654.321-00",
      "amount": 2500.50,
      "dueDate": "2024-11-15"
    }
  ]
}`,
                      "Exemplo de payload copiado!"
                    )}
                  >
                    <Copy className="mr-1 h-3 w-3" />
                    Copiar Exemplo
                  </Button>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-2">Requisitos do Payload</h3>
                  <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
                    <li><strong>projectId:</strong> UUID do projeto (obrigatório)</li>
                    <li><strong>receivables:</strong> Array de recebíveis (obrigatório)</li>
                    <li><strong>buyerName:</strong> Nome do comprador (obrigatório)</li>
                    <li><strong>buyerCpf:</strong> CPF do comprador (obrigatório)</li>
                    <li><strong>amount:</strong> Valor do recebível (obrigatório)</li>
                    <li><strong>dueDate:</strong> Data de vencimento no formato YYYY-MM-DD (obrigatório)</li>
                    <li><strong>description:</strong> Descrição do recebível (opcional)</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-2">Exemplo de Resposta</h3>
                  <div className="text-sm text-gray-600 mb-4">
                    A API retorna detalhes dos recebíveis processados com sucesso e erros.
                  </div>
                  <div className="bg-slate-950 text-white p-4 rounded-md overflow-x-auto text-sm font-mono mb-2">
                    {`{
  "project": {
    "id": "uuid-do-projeto",
    "name": "Nome do Projeto"
  },
  "results": {
    "total": 2,
    "success": 1,
    "errors": 1,
    "successRecords": [
      {
        "id": "uuid-do-recebivel",
        "project_id": "uuid-do-projeto",
        "buyer_name": "Nome do Comprador",
        "buyer_cpf": "12345678900",
        "amount": 1000.00,
        "due_date": "2024-12-31",
        "description": "Descrição do recebível",
        "status": "enviado",
        "created_at": "2023-05-25T12:34:56Z"
      }
    ],
    "errorRecords": [
      {
        "receivable": {
          "buyerName": "Nome do Comprador 2",
          "buyerCpf": "987.654.321-00",
          "amount": 2500.50,
          "dueDate": "2024-11-15"
        },
        "error": "Invalid CPF"
      }
    ]
  }
}`}
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <h3 className="text-lg font-medium mb-2">Implementações de Exemplo</h3>
                  <div className="flex flex-col space-y-4">
                    <div>
                      <h4 className="font-medium mb-1">Python</h4>
                      <div className="bg-slate-950 text-white p-4 rounded-md overflow-x-auto text-sm font-mono mb-2">
                        {`import requests
import base64
import json

# Credenciais
client_id = 'seu_client_id'
client_secret = 'seu_client_secret'

# Autenticação Basic Auth
credentials = f"{client_id}:{client_secret}"
encoded_credentials = base64.b64encode(credentials.encode('utf-8')).decode('utf-8')
headers = {
    'Authorization': f'Basic {encoded_credentials}',
    'Content-Type': 'application/json'
}

# Dados dos recebíveis
payload = {
    'projectId': 'uuid-do-projeto',
    'receivables': [
        {
            'buyerName': 'Nome do Comprador',
            'buyerCpf': '123.456.789-00',
            'amount': 1000.00,
            'dueDate': '2024-12-31',
            'description': 'Descrição do recebível'
        }
    ]
}

# Requisição para a API
response = requests.post(
    '${window.location.origin}/functions/project-receivables-api',
    headers=headers,
    data=json.dumps(payload)
)

# Processamento da resposta
if response.status_code == 200:
    result = response.json()
    print(f"Processados: {result['results']['total']}")
    print(f"Sucessos: {result['results']['success']}")
    print(f"Erros: {result['results']['errors']}")
else:
    print(f"Erro: {response.status_code} - {response.text}")
`}
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center"
                        onClick={() => copyToClipboard(
                          `import requests
import base64
import json

# Credenciais
client_id = 'seu_client_id'
client_secret = 'seu_client_secret'

# Autenticação Basic Auth
credentials = f"{client_id}:{client_secret}"
encoded_credentials = base64.b64encode(credentials.encode('utf-8')).decode('utf-8')
headers = {
    'Authorization': f'Basic {encoded_credentials}',
    'Content-Type': 'application/json'
}

# Dados dos recebíveis
payload = {
    'projectId': 'uuid-do-projeto',
    'receivables': [
        {
            'buyerName': 'Nome do Comprador',
            'buyerCpf': '123.456.789-00',
            'amount': 1000.00,
            'dueDate': '2024-12-31',
            'description': 'Descrição do recebível'
        }
    ]
}

# Requisição para a API
response = requests.post(
    '${window.location.origin}/functions/project-receivables-api',
    headers=headers,
    data=json.dumps(payload)
)

# Processamento da resposta
if response.status_code == 200:
    result = response.json()
    print(f"Processados: {result['results']['total']}")
    print(f"Sucessos: {result['results']['success']}")
    print(f"Erros: {result['results']['errors']}")
else:
    print(f"Erro: {response.status_code} - {response.text}")`,
                          "Exemplo Python copiado!"
                        )}
                      >
                        <Copy className="mr-1 h-3 w-3" />
                        Copiar Código
                      </Button>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-1">JavaScript/Node.js</h4>
                      <div className="bg-slate-950 text-white p-4 rounded-md overflow-x-auto text-sm font-mono mb-2">
                        {`const fetch = require('node-fetch');

// Credenciais
const clientId = 'seu_client_id';
const clientSecret = 'seu_client_secret';

// Autenticação Basic Auth
const credentials = Buffer.from(\`\${clientId}:\${clientSecret}\`).toString('base64');
const headers = {
  'Authorization': \`Basic \${credentials}\`,
  'Content-Type': 'application/json'
};

// Dados dos recebíveis
const payload = {
  projectId: 'uuid-do-projeto',
  receivables: [
    {
      buyerName: 'Nome do Comprador',
      buyerCpf: '123.456.789-00',
      amount: 1000.00,
      dueDate: '2024-12-31',
      description: 'Descrição do recebível'
    }
  ]
};

// Função para chamar a API
async function createReceivables() {
  try {
    const response = await fetch(
      '${window.location.origin}/functions/project-receivables-api',
      {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      }
    );
    
    const result = await response.json();
    
    if (response.ok) {
      console.log(\`Processados: \${result.results.total}\`);
      console.log(\`Sucessos: \${result.results.success}\`);
      console.log(\`Erros: \${result.results.errors}\`);
    } else {
      console.error(\`Erro: \${result.error}\`);
    }
  } catch (error) {
    console.error('Erro na requisição:', error);
  }
}

createReceivables();`}
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center"
                        onClick={() => copyToClipboard(
                          `const fetch = require('node-fetch');

// Credenciais
const clientId = 'seu_client_id';
const clientSecret = 'seu_client_secret';

// Autenticação Basic Auth
const credentials = Buffer.from(\`\${clientId}:\${clientSecret}\`).toString('base64');
const headers = {
  'Authorization': \`Basic \${credentials}\`,
  'Content-Type': 'application/json'
};

// Dados dos recebíveis
const payload = {
  projectId: 'uuid-do-projeto',
  receivables: [
    {
      buyerName: 'Nome do Comprador',
      buyerCpf: '123.456.789-00',
      amount: 1000.00,
      dueDate: '2024-12-31',
      description: 'Descrição do recebível'
    }
  ]
};

// Função para chamar a API
async function createReceivables() {
  try {
    const response = await fetch(
      '${window.location.origin}/functions/project-receivables-api',
      {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      }
    );
    
    const result = await response.json();
    
    if (response.ok) {
      console.log(\`Processados: \${result.results.total}\`);
      console.log(\`Sucessos: \${result.results.success}\`);
      console.log(\`Erros: \${result.results.errors}\`);
    } else {
      console.error(\`Erro: \${result.error}\`);
    }
  } catch (error) {
    console.error('Erro na requisição:', error);
  }
}

createReceivables();`,
                          "Exemplo JavaScript copiado!"
                        )}
                      >
                        <Copy className="mr-1 h-3 w-3" />
                        Copiar Código
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 pt-4 border-t">
                  <h3 className="font-medium mb-2">Precisa de ajuda?</h3>
                  <p className="text-sm text-gray-600">
                    Para obter mais informações ou suporte com a integração, entre em contato com nossa equipe de suporte.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button variant="outline" className="flex items-center">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Ver documentação completa
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Confirmation dialog for generating new credentials */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar novas credenciais?</DialogTitle>
            <DialogDescription>
              Isso irá desativar todas as suas credenciais existentes. Essa ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {hasActiveCredential && (
              <Alert variant="destructive">
                <AlertTitle>Atenção</AlertTitle>
                <AlertDescription>
                  Você já possui credenciais ativas. Gerar novas credenciais irá desativar as anteriores, 
                  o que pode interromper integrações existentes.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>Cancelar</Button>
            <Button onClick={handleGenerateCredentials} disabled={isGenerating}>
              {isGenerating ? "Gerando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog to show the newly generated credentials */}
      <Dialog open={showCredentialsDialog} onOpenChange={setShowCredentialsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novas Credenciais Geradas</DialogTitle>
            <DialogDescription>
              Esta é a única vez que você verá o Client Secret completo. Salve essas informações em um local seguro.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <div className="text-sm font-medium mb-1">Client ID</div>
              <div className="flex items-center space-x-2">
                <div className="bg-gray-100 p-2 rounded text-sm font-mono flex-1 overflow-x-auto">
                  {newCredential?.client_id}
                </div>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => copyToClipboard(
                    newCredential?.client_id || "", 
                    "Client ID copiado!"
                  )}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div>
              <div className="text-sm font-medium mb-1">Client Secret</div>
              <div className="flex items-center space-x-2">
                <div className="bg-gray-100 p-2 rounded text-sm font-mono flex-1 overflow-x-auto">
                  {newCredential?.client_secret}
                </div>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => copyToClipboard(
                    newCredential?.client_secret || "", 
                    "Client Secret copiado!"
                  )}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <Alert className="mt-4">
              <Lock className="h-4 w-4" />
              <AlertTitle>Atenção</AlertTitle>
              <AlertDescription>
                Por motivos de segurança, o Client Secret não poderá ser visualizado novamente
                após fechar esta janela. Se você perder estas credenciais, precisará gerar novas.
              </AlertDescription>
            </Alert>
          </div>
          
          <DialogFooter>
            <Button 
              onClick={() => {
                setShowCredentialsDialog(false);
                setNewCredential(null);
              }}
            >
              Entendi, salvei as credenciais
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
};

export default IntegrationsPage;
