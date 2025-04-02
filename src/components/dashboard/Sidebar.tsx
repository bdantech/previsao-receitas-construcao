
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { 
  ChevronLeft, 
  ChevronRight, 
  LayoutDashboard, 
  Building2, 
  FileText, 
  ArrowRightLeft, 
  LogOut 
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  to: string;
  isCollapsed: boolean;
}

const SidebarItem = ({ 
  icon: Icon, 
  label, 
  to, 
  isCollapsed 
}: SidebarItemProps) => {
  return (
    <NavLink 
      to={to} 
      className={({ isActive }) => cn(
        "flex items-center w-full px-3 py-2 my-1",
        isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium rounded-md" : 
        "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md"
      )}
    >
      {({ isActive }) => (
        <>
          <Icon className={cn("h-5 w-5", isActive && "text-sidebar-accent-foreground")} />
          {!isCollapsed && <span className="ml-3">{label}</span>}
        </>
      )}
    </NavLink>
  );
};

export const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const toggleSidebar = () => {
    setIsCollapsed(prev => !prev);
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        description: "Logout realizado com sucesso",
      });
      navigate('/auth');
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
      icon: LayoutDashboard,
      label: "Dashboard",
      to: "/dashboard"
    },
    {
      icon: FileText,
      label: "Projetos",
      to: "/projects"
    },
    {
      icon: Building2,
      label: "Minha Empresa",
      to: "/company"
    },
    {
      icon: ArrowRightLeft,
      label: "Integrações",
      to: "/integrations"
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
              key={item.to}
              icon={item.icon} 
              label={item.label} 
              to={item.to}
              isCollapsed={isCollapsed}
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
          onClick={handleSignOut}
        >
          <LogOut className="h-5 w-5" />
          {!isCollapsed && <span>Sair</span>}
        </Button>
      </div>
    </div>
  );
};
