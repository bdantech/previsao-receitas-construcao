import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { getAuthHeaders, supabase } from "@/integrations/supabase/client";
import { Copy, Loader, Plus, Trash } from "lucide-react";
import { useEffect, useState } from "react";

interface WebhookEndpoint {
  id: string;
  url_path: string;
  tag: string;
  description: string | null;
  created_at: string;
}

export const WebhookEndpoints = () => {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newEndpoint, setNewEndpoint] = useState({
    tag: "",
    description: "",
  });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchEndpoints = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('webhook_endpoints')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        setEndpoints(data as WebhookEndpoint[]);
      } catch (error) {
        console.error("Error fetching webhook endpoints:", error);
        toast({
          variant: "destructive",
          description: "Erro ao carregar endpoints",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchEndpoints();
  }, []);

  const handleCreateEndpoint = async () => {
    if (!newEndpoint.tag) {
      toast({
        variant: "destructive",
        description: "Tag é obrigatória",
      });
      return;
    }

    setCreating(true);
    try {
      console.log('Getting session...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('Session error:', sessionError);
        toast({
          variant: "destructive",
          description: "Erro de autenticação. Por favor, faça login novamente.",
        });
        return;
      }

      console.log('Session obtained, calling edge function...');
      const { data, error } = await supabase.functions.invoke('webhook-endpoints', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          tag: newEndpoint.tag,
          description: newEndpoint.description
        }
      });

      console.log('Edge function response:', { data, error });

      if (error) {
        throw error;
      }

      setEndpoints([data, ...endpoints]);
      setNewEndpoint({ tag: "", description: "" });
      setShowCreateDialog(false);
      toast({
        description: "Endpoint criado com sucesso",
      });
    } catch (error) {
      console.error("Error creating webhook endpoint:", error);
      toast({
        variant: "destructive",
        description: "Erro ao criar endpoint",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteEndpoint = async (id: string) => {
    try {
      const headers = await getAuthHeaders();
      const { data, error } = await supabase.functions.invoke('webhook-endpoints', {
        method: 'DELETE',
        headers,
        body: { id }
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setEndpoints(endpoints.filter((endpoint) => endpoint.id !== id));
      toast({
        description: "Endpoint deletado com sucesso",
      });
    } catch (error) {
      console.error("Error deleting webhook endpoint:", error);
      toast({
        variant: "destructive",
        description: error.message || "Erro ao deletar endpoint",
      });
    }
  };

  const copyToClipboard = (text: string) => {
    console.log('clikc aqui')
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado",
      description: "Texto copiado para a área de transferência",
    });
  };


  if (loading) {
    return (
      <>
        <div className="flex justify-center my-10">
          <Loader className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-semibold">Endpoints de Webhook</h2>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Endpoint
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Endpoint</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label htmlFor="tag" className="text-sm font-medium">
                    Tag
                  </label>
                  <Input
                    id="tag"
                    value={newEndpoint.tag}
                    onChange={(e) =>
                      setNewEndpoint({ ...newEndpoint, tag: e.target.value })
                    }
                    placeholder="Ex: payment-notifications"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="description" className="text-sm font-medium">
                    Descrição
                  </label>
                  <Textarea
                    id="description"
                    value={newEndpoint.description}
                    onChange={(e) =>
                      setNewEndpoint({
                        ...newEndpoint,
                        description: e.target.value,
                      })
                    }
                    placeholder="Descrição do endpoint"
                  />
                </div>
                <Button
                  onClick={handleCreateEndpoint}
                  disabled={creating}
                  className="w-full"
                >
                  {creating ? (
                    <Loader className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Criar Endpoint
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag</TableHead>
                <TableHead>URL Path</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {endpoints.map((endpoint) => {
                const urlpath = import.meta.env.VITE_SUPABASE_URL + "/functions/v1/webhook-events/" + endpoint.url_path;
                return (
                  <TableRow key={endpoint.id}>
                  <TableCell>{endpoint.tag}</TableCell>
                  <TableCell>
                    {urlpath}
                    <Button
                      variant="outline"
                      size="icon"
                      style={{
                        marginLeft: '8px'
                      }}
                      onClick={() => copyToClipboard(urlpath)}
                    >
                      <Copy size={10}/>
                    </Button>
                  </TableCell>
                  <TableCell>{endpoint.description || "-"}</TableCell>
                  <TableCell>
                    {new Date(endpoint.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteEndpoint(endpoint.id)}
                    >
                      <Trash className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
                )
              })}
              {endpoints.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-4">
                    Nenhum endpoint encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}; 