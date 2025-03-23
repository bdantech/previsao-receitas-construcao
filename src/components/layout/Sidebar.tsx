
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Building2,
  ChevronLeft,
  CreditCard,
  Home,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  Users,
  Wallet,
  Code
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { userRole, signOut, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Logout handler
  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  // Determine if a link is active
  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r shadow-sm transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-full flex-col overflow-y-auto">
          <div className="flex h-14 items-center border-b px-4">
            <Skeleton className="h-6 w-24" />
            <div className="ml-auto md:hidden">
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
          <div className="flex-1 space-y-1 p-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r shadow-sm transition-transform duration-300 ease-in-out",
      isOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      <div className="flex h-full flex-col overflow-y-auto">
        <div className="flex h-14 items-center border-b px-4">
          <div className="font-semibold text-lg">Anteciplog</div>
          <div className="ml-auto md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Close sidebar</span>
            </Button>
          </div>
        </div>
        <div className="flex-1 py-2">
          <nav className="grid items-start px-2 space-y-1">
            {/* Admin Navigation */}
            {userRole === 'admin' && (
              <>
                <Link
                  to="/admin/dashboard"
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100 hover:text-gray-900",
                    isActive('/admin/dashboard') ? "bg-gray-100 text-gray-900" : "text-gray-500"
                  )}
                >
                  <Home className="h-4 w-4" />
                  Dashboard
                </Link>
                <Link
                  to="/admin/buyers"
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100 hover:text-gray-900",
                    isActive('/admin/buyers') ? "bg-gray-100 text-gray-900" : "text-gray-500"
                  )}
                >
                  <Users className="h-4 w-4" />
                  Compradores
                </Link>
                <Link
                  to="/admin/receivables"
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100 hover:text-gray-900",
                    isActive('/admin/receivables') ? "bg-gray-100 text-gray-900" : "text-gray-500"
                  )}
                >
                  <CreditCard className="h-4 w-4" />
                  Recebíveis
                </Link>
                <Link
                  to="/admin/anticipations"
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100 hover:text-gray-900",
                    isActive('/admin/anticipations') ? "bg-gray-100 text-gray-900" : "text-gray-500"
                  )}
                >
                  <Wallet className="h-4 w-4" />
                  Antecipações
                </Link>
              </>
            )}

            {/* Company User Navigation */}
            {userRole === 'company_user' && (
              <>
                <Link
                  to="/dashboard"
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100 hover:text-gray-900",
                    isActive('/dashboard') && !isActive('/dashboard/') ? "bg-gray-100 text-gray-900" : "text-gray-500"
                  )}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
                <Link
                  to="/projects"
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100 hover:text-gray-900",
                    isActive('/projects') || isActive('/project-dashboard') ? "bg-gray-100 text-gray-900" : "text-gray-500"
                  )}
                >
                  <Package className="h-4 w-4" />
                  Projetos
                </Link>
                <Link
                  to="/company"
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100 hover:text-gray-900",
                    isActive('/company') ? "bg-gray-100 text-gray-900" : "text-gray-500"
                  )}
                >
                  <Building2 className="h-4 w-4" />
                  Empresa
                </Link>
                <Link
                  to="/integrations"
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100 hover:text-gray-900",
                    isActive('/integrations') ? "bg-gray-100 text-gray-900" : "text-gray-500"
                  )}
                >
                  <Code className="h-4 w-4" />
                  Integrações
                </Link>
              </>
            )}
          </nav>
        </div>
        <div className="mt-auto p-4">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
