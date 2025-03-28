
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Building, Users, FileText, ReceiptText, LogOut, Calendar, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  href: string;
  isCollapsed: boolean;
  isActive: boolean;
}

const SidebarItem = ({ 
  icon: Icon, 
  label, 
  href, 
  isCollapsed,
  isActive
}: SidebarItemProps) => {
  return (
    <Link to={href}>
      <Button 
        variant="ghost" 
        className={cn(
          "w-full justify-start gap-3 px-3 py-2 my-1",
          isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : 
          "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <Icon className="h-5 w-5" />
        {!isCollapsed && <span>{label}</span>}
      </Button>
    </Link>
  );
};

export const AdminSidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const toggleSidebar = () => {
    setIsCollapsed(prev => !prev);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/admin/auth');
      toast({
        description: "Logout realizado com sucesso",
      });
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        variant: "destructive",
        description: "Erro ao realizar logout",
      });
    }
  };

  const sidebarItems = [
    {
      icon: Building,
      label: "Empresas",
      href: "/admin/dashboard"
    },
    {
      icon: Users,
      label: "Compradores",
      href: "/admin/buyers"
    },
    {
      icon: FileText,
      label: "Recebíveis",
      href: "/admin/receivables"
    },
    {
      icon: ReceiptText,
      label: "Antecipações",
      href: "/admin/anticipations"
    },
    {
      icon: Calendar,
      label: "Planos de Pagamento",
      href: "/admin/payment-plans"
    },
    {
      icon: Settings,
      label: "Configurações",
      href: "/admin/settings"
    }
  ];

  return (
    <div 
      className={cn(
        "h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col",
        isCollapsed ? "w-[70px]" : "w-[250px]"
      )}
    >
      <div className="p-4 flex items-center justify-between border-b border-sidebar-border">
        {!isCollapsed ? (
          <div className="flex items-center space-x-1">
            <span className="font-bold text-xl text-gray-500">ONE</span>
            <span className="font-bold text-xl text-green-500">PAY</span>
            <span className="ml-1 text-xs text-gray-500 font-medium">ADMIN</span>
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <span className="font-bold text-xl text-green-500">OP</span>
          </div>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleSidebar}
          className="ml-auto text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </Button>
      </div>

      <div className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {sidebarItems.map((item) => (
            <SidebarItem 
              key={item.href}
              icon={item.icon} 
              label={item.label} 
              href={item.href}
              isCollapsed={isCollapsed}
              isActive={location.pathname === item.href}
            />
          ))}
        </nav>
      </div>

      <div className="px-3 py-4 border-t border-sidebar-border">
        <Button 
          variant="ghost" 
          className={cn(
            "w-full justify-start gap-3 px-3 py-2",
            "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          {!isCollapsed && <span>Sair</span>}
        </Button>
      </div>
    </div>
  );
};
