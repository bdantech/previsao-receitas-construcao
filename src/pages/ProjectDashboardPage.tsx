
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { projectManagementApi } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

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
        console.log(`Fetching project with ID: ${projectId}`);
        const fetchedProject = await projectManagementApi.getProject(projectId);
        console.log("Project data received:", fetchedProject);
        
        if (fetchedProject) {
          setProject(fetchedProject);
        } else {
          console.error("Project data is null or undefined");
          toast({
            title: "Erro",
            description: "Não foi possível encontrar o projeto.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Erro ao buscar projeto:", error);
        toast({
          title: "Erro",
          description: error.message || "Falha ao carregar os detalhes do projeto.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (session) {
      fetchProject();
    } else {
      console.log("No session available, waiting for authentication");
    }
  }, [projectId, toast, session]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-8 w-64" />
          <div className="space-x-2">
            <Skeleton className="h-10 w-40 inline-block" />
            <Skeleton className="h-10 w-40 inline-block" />
          </div>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto py-6 text-center">
        <h1 className="text-2xl font-bold mb-4">Projeto não encontrado</h1>
        <p className="mb-6">O projeto que você está tentando acessar não existe ou você não tem permissão para visualizá-lo.</p>
        <Button onClick={() => navigate("/projects")}>
          Voltar para Lista de Projetos
        </Button>
      </div>
    );
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
