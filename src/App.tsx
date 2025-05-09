import { Toaster } from "@/components/ui/toaster";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import AnticipationDetails from "./components/anticipations/AnticipationDetails";
import CreateAnticipationForm from "./components/anticipations/CreateAnticipationForm";
import { AdminDashboardLayout } from "./components/dashboard/AdminDashboardLayout";
import { DashboardLayout } from "./components/dashboard/DashboardLayout";
import { AuthProvider } from "./hooks/useAuth";
import { WebhookEndpoints } from "./pages/admin/WebhookEndpoints";
import AdminAnticipationsPage from "./pages/AdminAnticipationsPage";
import AdminAuth from "./pages/AdminAuth";
import AdminBankAccountsPage from "./pages/AdminBankAccountsPage";
import AdminBoletosPage from "./pages/AdminBoletosPage";
import AdminBuyersPage from "./pages/AdminBuyersPage";
import AdminCompanyDetail from "./pages/AdminCompanyDetail";
import AdminDashboard from "./pages/AdminDashboard";
import AdminPaymentPlanDetailPage from "./pages/AdminPaymentPlanDetailPage";
import AdminPaymentPlansPage from "./pages/AdminPaymentPlansPage";
import AdminReceivablesPage from "./pages/AdminReceivablesPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import AuthPage from "./pages/auth/AuthPage";
import ResetPassword from "./pages/auth/ResetPassword";
import CompanyPage from "./pages/CompanyPage";
import Dashboard from "./pages/Dashboard";
import IntegrationsPage from "./pages/IntegrationsPage";
import NotFound from "./pages/NotFound";
import ProjectDashboardPage from "./pages/ProjectDashboardPage";
import ProjectsPage from "./pages/ProjectsPage";
import PublicAnticipationContract from "./pages/public/AnticipationContractPage";
import PublicBuyerContract from "./pages/public/BuyerContractPage";
import { HelmetProvider } from "react-helmet-async";

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
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                {/* Public routes */}
                {/* <Route path="/" element={<Index />} /> */}
                <Route path="/" element={<AuthPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/admin/auth" element={<AdminAuth />} />
                <Route path="/public/anticipation/:anticipationId/contract" element={<PublicAnticipationContract />} />
                <Route path="/public/buyer/:buyerId/contract" element={<PublicBuyerContract />} />
                
                {/* Protected routes */}
                <Route element={<DashboardLayout/>}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/projects" element={<ProjectsPage />} />
                  <Route path="/project-dashboard/:projectId" element={<ProjectDashboardPage />} />
                  <Route path="/project-dashboard/:projectId/create-anticipation" element={<CreateAnticipationForm />} />
                  <Route path="/project-dashboard/:projectId/anticipation/:anticipationId" element={<AnticipationDetails />} />
                  <Route path="/company" element={<CompanyPage />} />
                  <Route path="/integrations" element={<IntegrationsPage />} />
                </Route>
                <Route element={<AdminDashboardLayout/>}>
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
                </Route>
                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              <Toaster />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </HelmetProvider>
    </React.StrictMode>
  );
}

export default App;
