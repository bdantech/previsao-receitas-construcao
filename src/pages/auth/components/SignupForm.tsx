
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Building, Eye, EyeOff, Lock, Mail } from "lucide-react";
import React, { useState } from "react";

interface SignupFormProps {
  toggleView: () => void;
}

const SignupForm = ({ toggleView }: SignupFormProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    companyName: "",
    companyCNPJ: "",
    companyWebsite: ""
  });

  const formatCNPJ = (value: string) => {
    return value
      .replace(/\D/g, "") // Remove tudo que não for número
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .slice(0, 18); // Limita o tamanho
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const { name, value } = e.target;

  let formattedValue = value;
  if (name === "companyCNPJ") {
    formattedValue = formatCNPJ(value);
  }

  setFormData((prev) => ({ ...prev, [name]: formattedValue }));
  setErrorMessage(null);
};


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { email, password, companyName, companyCNPJ, companyWebsite } = formData;
      
      if (!email || !password || !companyName || !companyCNPJ) {
        setErrorMessage("Preencha todos os campos obrigatórios");
        toast({
          title: "Erro",
          description: "Preencha todos os campos obrigatórios",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      console.log("[Auth] Sending registration request to Edge Function");
      const { data, error } = await supabase.functions.invoke('auth', {
        body: {
          action: 'register_company_user',
          email,
          password,
          companyData: {
            name: companyName,
            cnpj: companyCNPJ,
            website: companyWebsite
          }
        }
      });

      if (error) {
        console.error("[Auth] Edge Function error:", error);
        let errorMessage = "Erro ao chamar função de registro";
        
        // Extract the actual error message from the response
        if (error.message && error.message.includes("non-2xx status code")) {
          try {
            // Try to extract the response body from the error
            const regex = /Response body:\s*({.*})/;
            const match = regex.exec(error.message);
            
            if (match && match[1]) {
              const errorBody = JSON.parse(match[1]);
              if (errorBody.error) {
                errorMessage = errorBody.error;
              }
            }
          } catch (parseError) {
            console.error("[Auth] Error parsing error message:", parseError);
          }
        }
        
        throw new Error(errorMessage);
      }

      if (data?.error) {
        console.error("[Auth] Registration error from API:", data.error);
        throw new Error(data.error);
      }

      console.log("[Auth] Registration successful:", data);
      toast({
        title: "Conta criada",
        description: "Sua conta foi criada com sucesso!",
      });
      
      toggleView();
    } catch (error: any) {
      console.error("[Auth] Auth error:", error);
      const errorMsg = error.message || "Ocorreu um erro durante a autenticação";
      setErrorMessage(errorMsg);
      toast({
        title: "Erro",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {errorMessage}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-gray-700">
            Email
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Mail className="h-5 w-5 text-gray-400" />
            </div>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="seu@email.com"
              value={formData.email}
              onChange={handleInputChange}
              className="pl-10"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-gray-700">
            Senha
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400" />
            </div>
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={formData.password}
              onChange={handleInputChange}
              className="pl-10 pr-10"
              required
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center pr-3"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5 text-gray-400" />
              ) : (
                <Eye className="h-5 w-5 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="companyName" className="text-sm font-medium text-gray-700">
            Nome da Empresa
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Building className="h-5 w-5 text-gray-400" />
            </div>
            <Input
              id="companyName"
              name="companyName"
              type="text"
              placeholder="Nome da sua empresa"
              value={formData.companyName}
              onChange={handleInputChange}
              className="pl-10"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="companyCNPJ" className="text-sm font-medium text-gray-700">
            CNPJ
          </label>
          <div className="relative">
            <Input
              id="companyCNPJ"
              name="companyCNPJ"
              type="text"
              placeholder="00.000.000/0000-00"
              value={formData.companyCNPJ}
              onChange={handleInputChange}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="companyWebsite" className="text-sm font-medium text-gray-700">
            Website (opcional)
          </label>
          <div className="relative">
            <Input
              id="companyWebsite"
              name="companyWebsite"
              type="url"
              placeholder="https://www.exemplo.com.br"
              value={formData.companyWebsite}
              onChange={handleInputChange}
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full bg-[#1A1F2C] hover:bg-[#2A303C] text-white"
          disabled={isLoading}
        >
          {isLoading ? "Processando..." : "Criar conta"}
        </Button>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={toggleView}
            className="text-sm text-[#6E59A5] hover:underline"
          >
            Já tem uma conta? Entre aqui
          </button>
        </div>
      </form>
    </>
  );
};

export default SignupForm;
