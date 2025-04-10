import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import Index from "./pages/Index";
import AuthPage from "./pages/auth/AuthPage";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import { Toaster } from "@/components/ui/toaster"
import AdminAuth from "./pages/AdminAuth";
import AdminDashboard from "./pages/AdminDashboard";
import AdminCompanyDetail from "./pages/AdminCompanyDetail";
import AdminBuyersPage from "./pages/AdminBuyersPage";
import AdminReceivablesPage from "./pages/AdminReceivablesPage";
import AdminAnticipationsPage from "./pages/AdminAnticipationsPage";
import AdminPaymentPlansPage from "./pages/AdminPaymentPlansPage";
import AdminPaymentPlanDetailPage from "./pages/AdminPaymentPlanDetailPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import AdminBoletosPage from "./pages/AdminBoletosPage";
import AdminBankAccountsPage from "./pages/AdminBankAccountsPage";
import { WebhookEndpoints } from "./pages/admin/WebhookEndpoints";
import ProjectsPage from "./pages/ProjectsPage";
import CompanyPage from "./pages/CompanyPage";
import ProjectDashboardPage from "./pages/ProjectDashboardPage";
import CreateAnticipationForm from "./components/anticipations/CreateAnticipationForm";
import AnticipationDetails from "./components/anticipations/AnticipationDetails";
import IntegrationsPage from "./pages/IntegrationsPage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ResetPassword from "./pages/auth/ResetPassword";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/admin/auth" element={<AdminAuth />} />
              
              {/* Protected routes */}
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/project-dashboard/:projectId" element={<ProjectDashboardPage />} />
              <Route path="/project-dashboard/:projectId/create-anticipation" element={<CreateAnticipationForm />} />
              <Route path="/project-dashboard/:projectId/anticipation/:anticipationId" element={<AnticipationDetails />} />
              <Route path="/company" element={<CompanyPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/companies/:companyId" element={<AdminCompanyDetail />} />
              <Route path="/admin/buyers" element={<AdminBuyersPage />} />
              <Route path="/admin/receivables" element={<AdminReceivablesPage />} />
              <Route path="/admin/anticipations" element={<AdminAnticipationsPage />} />
              <Route path="/admin/payment-plans" element={<AdminPaymentPlansPage />} />
              <Route path="/admin/payment-plans/:paymentPlanId" element={<AdminPaymentPlanDetailPage />} />
              <Route path="/admin/boletos" element={<AdminBoletosPage />} />
              <Route path="/admin/bank-accounts" element={<AdminBankAccountsPage />} />
              <Route path="/admin/webhook-endpoints" element={<WebhookEndpoints />} />
              <Route path="/admin/settings" element={<AdminSettingsPage />} />
              
              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <Toaster />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>
  );
}

export default App;
