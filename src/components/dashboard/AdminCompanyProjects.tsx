import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProjectsList } from '@/components/projects/ProjectsList';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface AdminCompanyProjectsProps {
  companyId: string;
  companyName: string;
}

export const AdminCompanyProjects = ({ companyId, companyName }: AdminCompanyProjectsProps) => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { getAuthHeader } = useAuth();

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        
        // Call the admin-project-management edge function with proper auth
        const { data, error } = await supabase.functions.invoke('admin-project-management', {
          method: 'POST',
          headers: await getAuthHeader(),
          body: {
            companyId
          }
        });

        if (error) {
          console.error('Error fetching company projects:', error);
          throw error;
        }
        
        console.log('Projects data received:', data);
        setProjects(data?.projects || []);
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
  }, [companyId, toast, getAuthHeader]);

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
          <ProjectsList projects={projects} showDashboard={false} />
        )}
      </CardContent>
    </Card>
  );
};
