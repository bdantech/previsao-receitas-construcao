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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const button = (
    <Button 
      variant="ghost" 
      className={cn(
        "w-full justify-start gap-3 px-3 py-2 my-1",
        "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="h-5 w-5" />
      {!isCollapsed && <span>{label}</span>}
    </Button>
  );

  if (isCollapsed) {
    return (
      <NavLink to={to} onClick={(e) => e.stopPropagation()}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {button}
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-white">
              {label}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </NavLink>
    );
  }

  return <NavLink to={to}>{button}</NavLink>;
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
        "h-screen bg-[#ECECEC] border-r border-sidebar-border transition-all duration-300 flex flex-col relative",
        isCollapsed ? "w-[70px]" : "w-[250px]"
      )}
    >
      <div className="p-4 border-b border-sidebar-border">
        {!isCollapsed ? (
          <div className="flex items-center">
            <img src="/onepay-pro.png" alt="ONE Pay Pro" className="h-8" />
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <img src="/onepay.png" alt="ONE Pay" className="h-8" />
          </div>
        )}
      </div>

      {/* Centered toggle button */}
      <div className={cn(
        "absolute top-1/2 -translate-y-1/2 z-10",
        isCollapsed ? "left-0 right-0 flex justify-center" : "right-0 pr-5"
      )}>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleSidebar}
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </Button>
      </div>

      <div className="flex-1 px-3 py-4 overflow-y-auto">
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
        {isCollapsed ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  className={cn(
                    "w-full justify-start gap-3 px-3 py-2",
                    "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSignOut();
                  }}
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-white">
                Sair
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <Button 
            variant="ghost" 
            className={cn(
              "w-full justify-start gap-3 px-3 py-2",
              "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
            onClick={handleSignOut}
          >
            <LogOut className="h-5 w-5" />
            <span>Sair</span>
          </Button>
        )}
      </div>
    </div>
  );
};
