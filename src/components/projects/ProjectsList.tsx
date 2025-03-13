import { FolderKanban, LayoutDashboard } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ptBR } from "date-fns/locale";
import { formatCNPJ } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

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

interface ProjectsListProps {
  projects: Project[];
  showDashboard?: boolean;
}

export const ProjectsList = ({ projects, showDashboard = true }: ProjectsListProps) => {
  if (projects.length === 0) {
    return (
      <div className="text-center py-10 bg-white rounded-lg shadow">
        <FolderKanban className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-lg font-medium text-gray-900">Nenhum projeto</h3>
        <p className="mt-1 text-sm text-gray-500">
          Sua empresa ainda não possui projetos. Crie seu primeiro projeto clicando no botão acima.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nome
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                CNPJ
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Data Início
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Data Fim
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {projects.map((project) => (
              <tr key={project.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{project.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">{formatCNPJ(project.cnpj)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">
                    {format(new Date(project.initial_date), 'dd/MM/yyyy', { locale: ptBR })}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">
                    {project.end_date 
                      ? format(new Date(project.end_date), 'dd/MM/yyyy', { locale: ptBR })
                      : '-'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge 
                    variant={project.status === 'active' ? 'success' : 'destructive'}
                    className={project.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                  >
                    {project.status === 'active' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {showDashboard && (
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/project-dashboard/${project.id}`}>
                        <LayoutDashboard className="w-4 h-4 mr-2" />
                        Dashboard
                      </Link>
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
