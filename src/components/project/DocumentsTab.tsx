import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DocumentsTabProps {
  projectId: string;
}

export function DocumentsTab({ projectId }: DocumentsTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Documentos do Projeto</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Documentos do projeto {projectId}</p>
        </CardContent>
      </Card>
    </div>
  );
} 