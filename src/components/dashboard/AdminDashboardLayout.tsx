
import { ReactNode } from "react";
import { AdminSidebar } from "./AdminSidebar";

interface AdminDashboardLayoutProps {
  children: ReactNode;
}

export const AdminDashboardLayout = ({ children }: AdminDashboardLayoutProps) => {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
