
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Loader, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ProjectsList } from "@/components/projects/ProjectsList";
import { ProjectDialog } from "@/components/projects/ProjectDialog";

const ProjectsPage = () => {
  const { session, userRole, isLoading } = useAuth();
  const [isLoading2, setIsLoading2] = useState(true);
  const [projects, setProjects] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setIsLoading2(true);
        
        const response = await supabase.functions.invoke('project-management', {
          body: {
            method: 'GET',
            endpoint: 'projects'
          }
        });
        
        if (response.error) {
          console.error('Error fetching projects:', response.error);
          return;
        }
        
        console.log('Projects response:', response);
        setProjects(response.data.projects || []);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setIsLoading2(false);
      }
    };
    
    if (session) {
      fetchProjects();
    }
  }, [session]);
  
  const handleProjectCreated = (newProject) => {
    console.log('New project created:', newProject);
    setProjects((prevProjects) => [...prevProjects, newProject]);
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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Projetos</h1>
          <Button 
            onClick={() => setIsDialogOpen(true)}
            className="bg-green-500 hover:bg-green-600"
          >
            <Plus className="mr-2 h-4 w-4" /> Criar Projeto
          </Button>
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
