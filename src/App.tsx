
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
import ProjectsPage from "./pages/ProjectsPage";
import CompanyPage from "./pages/CompanyPage";
import ProjectDashboardPage from "./pages/ProjectDashboardPage";
import CreateAnticipationForm from "./components/anticipations/CreateAnticipationForm";
import AnticipationDetails from "./components/anticipations/AnticipationDetails";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/admin/auth" element={<AdminAuth />} />
            
            {/* Protected routes */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/project-dashboard/:projectId" element={<ProjectDashboardPage />} />
            <Route path="/project-dashboard/:projectId/create-anticipation" element={<CreateAnticipationForm />} />
            <Route path="/project-dashboard/:projectId/anticipation/:anticipationId" element={<AnticipationDetails />} />
            <Route path="/company" element={<CompanyPage />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/companies/:companyId" element={<AdminCompanyDetail />} />
            <Route path="/admin/buyers" element={<AdminBuyersPage />} />
            <Route path="/admin/receivables" element={<AdminReceivablesPage />} />
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
