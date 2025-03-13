import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="text-center max-w-3xl">
        <h1 className="text-4xl sm:text-5xl font-bold text-[#1A1F2C] mb-4">
          ONE for Developers 2.0
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Plataforma de gerenciamento financeiro para construtoras
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild className="bg-[#1A1F2C] hover:bg-[#2A303C] px-8 py-6">
            <Link to="/auth">Acesso para Empresas</Link>
          </Button>
          
          <Button asChild variant="outline" className="px-8 py-6 border-[#1A1F2C] text-[#1A1F2C]">
            <Link to="/admin/auth">Acesso Administrativo</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
