
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader, UsersRound, Receipt, ArrowDownToLine, FileSpreadsheet, PencilIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCNPJ } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface Project {
  id: string;
  name: string;
  cnpj: string;
  initial_date: string;
  end_date: string | null;
  status: 'active' | 'inactive';
  companies: {
    name: string;
  };
}

const ProjectDashboardPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { session } = useAuth();
  const { toast } = useToast();
  
  // State for edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedInitialDate, setEditedInitialDate] = useState("");
  const [editedEndDate, setEditedEndDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchProjectDetails = async () => {
      if (!projectId || !session?.access_token) return;

      try {
        setIsLoading(true);
        
        const { data, error } = await supabase.functions.invoke('project-management', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: {
            method: 'GET',
            endpoint: `projects/${projectId}`
          }
        });
        
        if (error) {
          console.error('Error fetching project details:', error);
          return;
        }
        
        console.log('Project details:', data);
        setProject(data.project || null);
        
        // Initialize edit form values
        if (data.project) {
          setEditedName(data.project.name);
          setEditedInitialDate(data.project.initial_date);
          setEditedEndDate(data.project.end_date || "");
        }
      } catch (error) {
        console.error('Error fetching project details:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProjectDetails();
  }, [projectId, session]);

  const handleSaveProject = async () => {
    if (!projectId || !session?.access_token) return;
    
    try {
      setIsSaving(true);
      
      // Fix: Don't include "projects/" in the endpoint parameter, but send the ID directly
      const { data, error } = await supabase.functions.invoke('project-management', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          method: 'PUT',
          endpoint: `${projectId}`, // Fixed: removed "projects/" prefix
          name: editedName,
          initial_date: editedInitialDate,
          end_date: editedEndDate || null
        }
      });
      
      if (error) {
        console.error('Error updating project:', error);
        toast({
          title: "Erro ao atualizar projeto",
          description: "Não foi possível salvar as alterações.",
          variant: "destructive"
        });
        return;
      }
      
      setProject(data.project);
      toast({
        title: "Projeto atualizado",
        description: "As alterações foram salvas com sucesso.",
        variant: "default"  // Changed from "success" to "default"
      });
      
      setEditDialogOpen(false);
    } catch (error) {
      console.error('Error updating project:', error);
      toast({
        title: "Erro ao atualizar projeto",
        description: "Não foi possível salvar as alterações.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-[calc(100vh-120px)]">
          <Loader className="h-8 w-8 animate-spin text-gray-500" />
        </div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return (
      <DashboardLayout>
        <div className="text-center py-10">
          <h2 className="text-2xl font-bold text-gray-900">Projeto não encontrado</h2>
          <p className="mt-2 text-gray-500">O projeto solicitado não existe ou você não tem permissão para acessá-lo.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{project.name}</h1>
              <Badge variant={project.status === 'active' ? 'success' : 'secondary'}>
                {project.status === 'active' ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
              <div>CNPJ: {formatCNPJ(project.cnpj)}</div>
              <div>Início: {format(new Date(project.initial_date), 'dd/MM/yyyy', { locale: ptBR })}</div>
              {project.end_date && (
                <div>Término: {format(new Date(project.end_date), 'dd/MM/yyyy', { locale: ptBR })}</div>
              )}
            </div>
          </div>
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={() => setEditDialogOpen(true)}
          >
            <PencilIcon className="h-4 w-4" />
            Editar Projeto
          </Button>
        </div>

        {/* Edit Project Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Editar Projeto</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Projeto</Label>
                <Input
                  id="name"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="initialDate">Data de Início</Label>
                <Input
                  id="initialDate"
                  type="date"
                  value={editedInitialDate}
                  onChange={(e) => setEditedInitialDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Data de Término</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={editedEndDate}
                  onChange={(e) => setEditedEndDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveProject} disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar alterações"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total de Compradores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Recebíveis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ 0,00</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Antecipações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ 0,00</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Boletos Emitidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="compradores" className="w-full">
          <TabsList className="mb-4 bg-white">
            <TabsTrigger value="compradores" className="flex items-center gap-2">
              <UsersRound className="h-4 w-4" />
              Compradores
            </TabsTrigger>
            <TabsTrigger value="recebiveis" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Recebíveis
            </TabsTrigger>
            <TabsTrigger value="antecipacoes" className="flex items-center gap-2">
              <ArrowDownToLine className="h-4 w-4" />
              Antecipações
            </TabsTrigger>
            <TabsTrigger value="boletos" className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Boletos
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="compradores" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Compradores</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-gray-500 py-8">
                  Nenhum comprador cadastrado para este projeto ainda.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="recebiveis" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Recebíveis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-gray-500 py-8">
                  Nenhum recebível cadastrado para este projeto ainda.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="antecipacoes" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Antecipações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-gray-500 py-8">
                  Nenhuma antecipação cadastrada para este projeto ainda.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="boletos" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Boletos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-gray-500 py-8">
                  Nenhum boleto cadastrado para este projeto ainda.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default ProjectDashboardPage;
