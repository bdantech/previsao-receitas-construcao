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

interface Company {
  id: string;
  name: string;
}

interface CompanySelectProps {
  value: string;
  onChange: (value: string) => void;
}

export const CompanySelect: React.FC<CompanySelectProps> = ({
  value,
  onChange,
}) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { getAuthHeader, session, userRole } = useAuth();

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      console.log('Fetching companies...');
      console.log('Current session:', session?.user?.id);
      console.log('User role:', userRole);

      const headers = await getAuthHeader();
      console.log('Auth headers:', headers);

      const { data, error } = await supabase.functions.invoke('company-data', {
        method: 'POST',
        headers,
        body: {} // Empty body for default admin action (fetch all companies)
      });

      if (error) {
        console.error("Error fetching companies:", error);
        return;
      }

      console.log('Response data:', data);

      if (data && data.companies) {
        console.log('Setting companies:', data.companies.length);
        setCompanies(data.companies);
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
      disabled={isLoading}
    >
      <SelectTrigger>
        <SelectValue placeholder="Selecione uma empresa" />
      </SelectTrigger>
      <SelectContent>
        {companies.map((company) => (
          <SelectItem key={company.id} value={company.id}>
            {company.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}; 