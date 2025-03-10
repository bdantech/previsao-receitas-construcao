
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Building, Settings, FolderKanban, LayoutDashboard } from "lucide-react";

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

export const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  
  const toggleSidebar = () => {
    setIsCollapsed(prev => !prev);
  };

  const sidebarItems = [
    {
      icon: LayoutDashboard,
      label: "Dashboard",
      href: "/dashboard"
    },
    {
      icon: FolderKanban,
      label: "Projetos",
      href: "/projects"
    },
    {
      icon: Building,
      label: "Minha Empresa",
      href: "/company"
    },
    {
      icon: Settings,
      label: "Configurações",
      href: "/settings"
    }
  ];

  return (
    <div 
      className={cn(
        "h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col",
        isCollapsed ? "w-[70px]" : "w-[250px]"
      )}
    >
      {/* Logo Area */}
      <div className="p-4 flex items-center justify-between border-b border-sidebar-border">
        {!isCollapsed ? (
          <div className="flex items-center space-x-1">
            <span className="font-bold text-2xl text-gray-500">ONE</span>
            <span className="font-bold text-2xl text-green-500">PAY</span>
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

      {/* Navigation */}
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
    </div>
  );
};
