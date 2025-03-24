
import { LayoutDashboard, CreditCard, Building2, ArrowRightLeft, CogIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { useAuth } from "@/hooks/useAuth";

export const Sidebar = () => {
  const { signOut, userRole } = useAuth();

  const isAdmin = userRole === 'admin';

  return (
    <div className="flex flex-col h-full border-r border-gray-200">
      <div className="flex-1 py-4">
        <div className="px-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Financify</h2>
          <p className="text-sm text-gray-500">Painel de Controle</p>
        </div>
        
        <Separator className="mb-4" />
        
        <nav className="px-2 space-y-1">
          <NavLink 
            to="/dashboard" 
            className={({ isActive }) => `
              flex items-center px-2 py-2 text-sm font-medium rounded-md
              ${isActive 
                ? 'bg-blue-100 text-blue-800' 
                : 'text-gray-600 hover:bg-gray-100'
              }
            `}
          >
            <LayoutDashboard className="mr-3 h-5 w-5" />
            Dashboard
          </NavLink>
          
          <NavLink 
            to="/projects" 
            className={({ isActive }) => `
              flex items-center px-2 py-2 text-sm font-medium rounded-md
              ${isActive 
                ? 'bg-blue-100 text-blue-800' 
                : 'text-gray-600 hover:bg-gray-100'
              }
            `}
          >
            <CreditCard className="mr-3 h-5 w-5" />
            Projetos
          </NavLink>
          
          <NavLink 
            to="/company" 
            className={({ isActive }) => `
              flex items-center px-2 py-2 text-sm font-medium rounded-md
              ${isActive 
                ? 'bg-blue-100 text-blue-800' 
                : 'text-gray-600 hover:bg-gray-100'
              }
            `}
          >
            <Building2 className="mr-3 h-5 w-5" />
            Minha Empresa
          </NavLink>
          
          <NavLink 
            to="/integrations" 
            className={({ isActive }) => `
              flex items-center px-2 py-2 text-sm font-medium rounded-md
              ${isActive 
                ? 'bg-blue-100 text-blue-800' 
                : 'text-gray-600 hover:bg-gray-100'
              }
            `}
          >
            <ArrowRightLeft className="mr-3 h-5 w-5" />
            Integrações
          </NavLink>
        </nav>
      </div>
      
      <div className="p-4">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={signOut}
        >
          <CogIcon className="mr-2 h-4 w-4" />
          Sair
        </Button>
      </div>
    </div>
  );
};
