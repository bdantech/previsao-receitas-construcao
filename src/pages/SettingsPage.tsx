
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Loader } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserDocumentList } from "@/components/company/UserDocumentList";

const SettingsPage = () => {
  const { session, userRole, isLoading } = useAuth();
  
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
        <h1 className="text-2xl font-bold mb-6">Configurações</h1>
        
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Seus Documentos</CardTitle>
            </CardHeader>
            <CardContent>
              <UserDocumentList />
            </CardContent>
          </Card>
          
          {/* Additional settings sections can be added here in the future */}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
