import React, { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Project {
  id: string;
  name: string;
}

interface ProjectSelectProps {
  value: string;
  onChange: (value: string) => void;
  companyId: string;
}

export const ProjectSelect: React.FC<ProjectSelectProps> = ({
  value,
  onChange,
  companyId,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { getAuthHeader } = useAuth();

  useEffect(() => {
    if (companyId) {
      fetchProjects();
    } else {
      setProjects([]);
      setIsLoading(false);
    }
  }, [companyId]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-project-management', {
        method: 'POST',
        headers: await getAuthHeader(),
        body: {
          companyId
        }
      });

      if (error) {
        console.error("Error fetching projects:", error);
        return;
      }

      if (data && data.projects) {
        setProjects(data.projects);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={isLoading || !companyId}
    >
      <SelectTrigger>
        <SelectValue placeholder={companyId ? "Selecione um projeto" : "Selecione uma empresa primeiro"} />
      </SelectTrigger>
      <SelectContent>
        {projects.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            {project.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}; 