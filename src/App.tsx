
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
import ProjectsPage from "./pages/ProjectsPage";
import CompanyPage from "./pages/CompanyPage";

function App() {
  return (
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
          <Route path="/company" element={<CompanyPage />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          
          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
