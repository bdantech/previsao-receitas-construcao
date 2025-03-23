import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Index from "@/pages/Index";
import Auth from "@/pages/Auth";
import AdminAuth from "@/pages/AdminAuth";
import Dashboard from "@/pages/Dashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminCompanyDetail from "@/pages/AdminCompanyDetail";
import AdminBuyersPage from "@/pages/AdminBuyersPage";
import AdminReceivablesPage from "@/pages/AdminReceivablesPage";
import AdminAnticipationsPage from "@/pages/AdminAnticipationsPage";
import ProjectsPage from "@/pages/ProjectsPage";
import ProjectDashboardPage from "@/pages/ProjectDashboardPage";
import CompanyPage from "@/pages/CompanyPage";
import IntegrationsPage from "@/pages/IntegrationsPage";
import NotFound from "@/pages/NotFound";
import ApiCredentialsPage from "@/pages/ApiCredentialsPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Index />,
    errorElement: <NotFound />,
  },
  {
    path: "/auth",
    element: <Auth />,
  },
  {
    path: "/admin-auth",
    element: <AdminAuth />,
  },
  {
    path: "/dashboard",
    element: <Dashboard />,
  },
  {
    path: "/admin",
    element: <AdminDashboard />,
  },
  {
    path: "/admin/company/:id",
    element: <AdminCompanyDetail />,
  },
  {
    path: "/admin/buyers",
    element: <AdminBuyersPage />,
  },
  {
    path: "/admin/receivables",
    element: <AdminReceivablesPage />,
  },
  {
    path: "/admin/anticipations",
    element: <AdminAnticipationsPage />,
  },
  {
    path: "/projects",
    element: <ProjectsPage />,
  },
  {
    path: "/projects/:id",
    element: <ProjectDashboardPage />,
  },
  {
    path: "/company",
    element: <CompanyPage />,
  },
  {
    path: "/integrations",
    element: <IntegrationsPage />,
  },
  {
    path: "/api-credentials",
    element: <ApiCredentialsPage />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);

function App() {
  return (
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>
  );
}

export default App;
