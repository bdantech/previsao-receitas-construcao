import { LayoutDashboard, FileText, Banknote } from 'lucide-react';
import { OverviewTab } from '@/components/project/OverviewTab';
import { DocumentsTab } from '@/components/project/DocumentsTab';
import { BankAccountTab } from '@/components/project/BankAccountTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getProjectById } from '@/lib/supabase';

interface ProjectPageProps {
  params: {
    id: string;
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const project = await getProjectById(params.id);

  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Projeto não encontrado</p>
      </div>
    );
  }

  const tabs = [
    {
      value: 'overview',
      label: 'Visão Geral',
      icon: LayoutDashboard,
      component: <OverviewTab project={project} />
    },
    {
      value: 'documents',
      label: 'Documentos',
      icon: FileText,
      component: <DocumentsTab projectId={project.id} />
    },
    {
      value: 'bank-account',
      label: 'Conta Bancária',
      icon: Banknote,
      component: <BankAccountTab projectId={project.id} />
    }
  ];

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>{project.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex items-center gap-2"
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {tabs.map((tab) => (
              <TabsContent key={tab.value} value={tab.value}>
                {tab.component}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
} 