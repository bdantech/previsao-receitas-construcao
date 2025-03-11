import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import Index from "./pages/Index";
import AuthPage from "./pages/auth/AuthPage";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import { Toaster } from "@/components/ui/toaster"
import AdminAuth from "./pages/AdminAuth";
import AdminDashboard from "./pages/AdminDashboard";
import AdminCompanyDetail from "./pages/AdminCompanyDetail";
import ProjectsPage from "./pages/ProjectsPage";
import CompanyPage from "./pages/CompanyPage";
import ProjectDashboardPage from "./pages/ProjectDashboardPage";
import NewReceivablePage from "./pages/NewReceivablePage";

function App() {
  return (
    <Router>
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
          <Route path="/company" element={<CompanyPage />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/companies/:companyId" element={<AdminCompanyDetail />} />
          <Route path="/project/:projectId/receivables/new" element={<NewReceivablePage />} />
          
          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
      </AuthProvider>
    </Router>
  );
}

export default App;
