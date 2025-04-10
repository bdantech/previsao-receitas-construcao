import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Bell, Building, Building2, Calendar, ChevronLeft, ChevronRight, File, FileText, LogOut, ReceiptText, Settings, Users } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

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
  const button = (
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
  );

  if (isCollapsed) {
    return (
      <Link to={href} onClick={(e) => e.stopPropagation()}>
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
      </Link>
    );
  }

  return <Link to={href}>{button}</Link>;
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
    const { error } = await supabase.auth.signOut();

    if(error)  {
      await supabase.auth.refreshSession()
    }
    
    navigate('/admin/auth');
    toast({
      description: "Logout realizado com sucesso",
    });
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
      icon: File,
      label: "Boletos",
      href: "/admin/boletos"
    },
    {
      icon: Building2,
      label: "Contas Bancárias",
      href: "/admin/bank-accounts"
    },
    {
      icon: Bell,
      label: "Eventos",
      href: "/admin/webhook-endpoints"
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
        "h-screen bg-[#ECECEC] border-r border-sidebar-border transition-all duration-300 flex flex-col relative",
        isCollapsed ? "w-[70px]" : "w-[250px]"
      )}
    >
      <div className="p-4 border-b border-sidebar-border">
        {!isCollapsed ? (
          <div className="flex items-center">
            <img src="/onepay-pro.png" alt="ONE Pay Pro" className="h-8" />
            <span className="ml-1 text-xs text-gray-500 font-medium">ADMIN</span>
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
                    handleLogout();
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
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
            <span>Sair</span>
          </Button>
        )}
      </div>
    </div>
  );
};
