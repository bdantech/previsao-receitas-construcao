import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface CompanyKPIsProps {
  companyId: string;
}

interface KPIData {
  activeProjects: number;
  totalBuyers: number;
  receivablesByStatus: Record<string, number>;
  anticipationsByStatus: Record<string, number>;
  boletosByStatus: Record<string, number>;
}

const getStatusColor = (status: string): string => {
  const statusColors: { [key: string]: string } = {
    'Antecipado': 'bg-green-50 text-green-700',
    'Enviado': 'bg-blue-50 text-blue-700',
    'Elegivel': 'bg-purple-50 text-purple-700',
    'Reprovado': 'bg-red-50 text-red-700',
    'Emitido': 'bg-gray-50 text-gray-700',
    'Pago': 'bg-emerald-50 text-emerald-700',
    'Vencido': 'bg-red-50 text-red-700',
    'Em Processamento': 'bg-orange-50 text-orange-700',
    'Pendente': 'bg-yellow-50 text-yellow-700',
    'Aprovado': 'bg-green-50 text-green-700'
  };
  return statusColors[status] || 'bg-gray-50 text-gray-700';
};

export const CompanyKPIs = ({ companyId }: CompanyKPIsProps) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<KPIData | null>(null);
  const { getAuthHeader } = useAuth();

  useEffect(() => {
    const fetchKPIs = async () => {
      try {
        const headers = getAuthHeader();
        console.log('Fetching KPIs with headers:', headers);

        const { data: kpiData, error } = await supabase.functions.invoke('company-kpi', {
          method: 'POST',
          headers: headers,
          body: { companyId }
        });

        if (error) {
          console.error('Error from edge function:', error);
          throw error;
        }

        console.log('KPI data received:', kpiData);
        setData(kpiData);
      } catch (error) {
        console.error('Error fetching KPI data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (companyId) {
      fetchKPIs();
    }
  }, [companyId, getAuthHeader]);

  const renderStatusKPIs = (data: Record<string, number>, title: string) => {
    return Object.entries(data).map(([status, amount]) => (
      <Card key={`${title}-${status}`} className="bg-white shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex flex-col space-y-2">
            <Badge variant="secondary" className={`${getStatusColor(status)} text-xs font-medium w-fit`}>
              {status}
            </Badge>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(amount)}
            </p>
          </div>
        </CardContent>
      </Card>
    ));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-8 py-8">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 px-6">
        {/* Project and Buyer KPIs */}
        <Card className="bg-white shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <h3 className="text-xs font-medium text-gray-500 mb-2">Projetos Ativos</h3>
            <p className="text-2xl font-bold text-gray-900">{data.activeProjects}</p>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <h3 className="text-xs font-medium text-gray-500 mb-2">Total de Compradores</h3>
            <p className="text-2xl font-bold text-gray-900">{data.totalBuyers}</p>
          </CardContent>
        </Card>
      </div>

      {/* Receivables Section */}
      <div className="px-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Recebíveis por Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {renderStatusKPIs(data.receivablesByStatus, 'Recebíveis')}
        </div>
      </div>

      {/* Anticipations and Boletos side by side */}
      <div className="px-6 grid grid-cols-1 lg:grid-cols-2 gap-8 relative">
        <div className="pr-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Antecipações por Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
            {renderStatusKPIs(data.anticipationsByStatus, 'Antecipações')}
          </div>
        </div>

        {/* Vertical Divider */}
        <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 transform -translate-x-px">
          <Separator orientation="vertical" className="h-full bg-gray-200" />
        </div>

        <div className="pl-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Boletos por Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
            {renderStatusKPIs(data.boletosByStatus, 'Boletos')}
          </div>
        </div>
      </div>
    </div>
  );
}; 