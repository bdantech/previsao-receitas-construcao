import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { projectManagementApi } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export function ProjectDashboardPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session } = useAuth();

  useEffect(() => {
    const fetchProject = async () => {
      if (!projectId) {
        toast({
          title: "Erro",
          description: "ID do projeto não fornecido.",
          variant: "destructive",
        });
        return;
      }

      try {
        setIsLoading(true);
        const fetchedProject = await projectManagementApi.getProject(projectId);
        setProject(fetchedProject);
      } catch (error: any) {
        console.error("Erro ao buscar projeto:", error);
        toast({
          title: "Erro",
          description:
            error.message || "Falha ao carregar os detalhes do projeto.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProject();
  }, [projectId, toast]);

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  if (!project) {
    return <div>Projeto não encontrado.</div>;
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dashboard do Projeto</h1>
        <div className="space-x-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/project/${projectId}/buyers`)}
          >
            Gerenciar Compradores
          </Button>
          <Button
            onClick={() => navigate(`/project/${projectId}/receivables/new`)}
          >
            Adicionar Recebível
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{project.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>CNPJ: {project.cnpj}</p>
          <p>Data de Início: {project.initial_date}</p>
          {project.end_date && <p>Data de Encerramento: {project.end_date}</p>}
          <p>Status: {project.status}</p>
        </CardContent>
      </Card>
    </div>
  );
}
