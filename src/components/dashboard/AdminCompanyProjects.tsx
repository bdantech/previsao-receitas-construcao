
import { useState, useEffect } from 'react';
import { projectManagementApi } from '@/integrations/supabase/client';
import { ProjectsList } from '@/components/projects/ProjectsList';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface AdminCompanyProjectsProps {
  companyId: string;
  companyName: string;
}

export const AdminCompanyProjects = ({ companyId, companyName }: AdminCompanyProjectsProps) => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const projectsData = await projectManagementApi.getCompanyProjects(companyId);
        setProjects(projectsData);
      } catch (error) {
        console.error('Failed to fetch company projects:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar os projetos desta empresa.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    if (companyId) {
      fetchProjects();
    }
  }, [companyId, toast]);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Projetos da Empresa: {companyName}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ProjectsList projects={projects} />
        )}
      </CardContent>
    </Card>
  );
};
