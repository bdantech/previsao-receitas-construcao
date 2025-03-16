
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Loader, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ProjectsList } from "@/components/projects/ProjectsList";
import { ProjectDialog } from "@/components/projects/ProjectDialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const ProjectsPage = () => {
  const { session, userRole, isLoading } = useAuth();
  const [isLoading2, setIsLoading2] = useState(true);
  const [projects, setProjects] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active");
  
  useEffect(() => {
    const fetchProjects = async () => {
      if (session?.access_token) {
        try {
          setIsLoading2(true);
          
          const { data, error } = await supabase.functions.invoke('project-management', {
            headers: {
              Authorization: `Bearer ${session.access_token}`
            },
            body: {
              method: 'GET',
              endpoint: 'projects',
              status: statusFilter
            }
          });
          
          if (error) {
            console.error('Error fetching projects:', error);
            return;
          }
          
          console.log('Projects response:', data);
          setProjects(data.projects || []);
        } catch (error) {
          console.error('Error fetching projects:', error);
        } finally {
          setIsLoading2(false);
        }
      }
    };
    
    if (session) {
      fetchProjects();
    }
  }, [session, statusFilter]);
  
  const handleProjectCreated = (newProject) => {
    console.log('New project created:', newProject);
    if (newProject.status === statusFilter || statusFilter === "all") {
      setProjects((prevProjects) => [...prevProjects, newProject]);
    }
    setIsDialogOpen(false);
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" />;
  }

  if (userRole === 'admin') {
    return <Navigate to="/admin/dashboard" />;
  }
  
  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold">Projetos</h1>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
            <ToggleGroup 
              type="single" 
              value={statusFilter}
              onValueChange={(value) => value && setStatusFilter(value)}
              className="border rounded-md bg-white"
            >
              <ToggleGroupItem value="active" className="text-sm">
                Ativos
              </ToggleGroupItem>
              <ToggleGroupItem value="inactive" className="text-sm">
                Inativos
              </ToggleGroupItem>
              <ToggleGroupItem value="all" className="text-sm">
                Todos
              </ToggleGroupItem>
            </ToggleGroup>
            
            <Button 
              onClick={() => setIsDialogOpen(true)}
              className="bg-green-500 hover:bg-green-600 ml-auto"
            >
              <Plus className="mr-2 h-4 w-4" /> Criar Projeto
            </Button>
          </div>
        </div>
        
        {isLoading2 ? (
          <div className="flex justify-center py-10">
            <Loader className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        ) : (
          <ProjectsList projects={projects} />
        )}
        
        <ProjectDialog 
          open={isDialogOpen} 
          onOpenChange={setIsDialogOpen}
          onProjectCreated={handleProjectCreated}
        />
      </div>
    </DashboardLayout>
  );
};

export default ProjectsPage;
