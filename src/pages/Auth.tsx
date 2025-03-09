import React, { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, Building } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const { session, user, userRole, isLoading: authLoading } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    companyName: "",
    companyCNPJ: "",
    companyWebsite: ""
  });

  useEffect(() => {
    console.log("[Auth] Effect triggered - session:", !!session, "userRole:", userRole, "authLoading:", authLoading);
    
    if (session && userRole && !authLoading) {
      console.log("[Auth] Redirecting user with role:", userRole);
      if (userRole === 'admin') {
        navigate("/admin/dashboard");
      } else {
        navigate("/dashboard");
      }
    }
  }, [session, userRole, authLoading, navigate]);

  if (!authLoading && session) {
    console.log("[Auth] Immediate redirect check - userRole:", userRole);
    if (userRole === 'admin') {
      return <Navigate to="/admin/dashboard" />;
    } else if (userRole) {
      return <Navigate to="/dashboard" />;
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrorMessage(null);
  };

  const toggleView = () => {
    setIsSignUp(!isSignUp);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (isSignUp) {
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
          throw new Error(error.message || "Erro ao chamar função de registro");
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
        
        setIsSignUp(false);
      } else {
        const { email, password } = formData;
        
        if (!email || !password) {
          setErrorMessage("Preencha email e senha");
          toast({
            title: "Erro",
            description: "Preencha email e senha",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        console.log("[Auth] Sending login request to Edge Function");
        const { data, error } = await supabase.functions.invoke('auth', {
          body: {
            action: 'login',
            email,
            password
          }
        });

        if (error) {
          console.error("[Auth] Edge Function error:", error);
          throw new Error(error.message || "Erro ao fazer login");
        }

        if (data?.error) {
          console.error("[Auth] Login error from API:", data.error);
          throw new Error(data.error);
        }

        console.log("[Auth] Login successful, data:", data);
        
        toast({
          title: "Login bem-sucedido",
          description: "Você entrou com sucesso na sua conta",
        });
        
        console.log("[Auth] Login successful, redirecting based on role:", data.role);
      }
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
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-[#1A1F2C]">ONE pay</h1>
          <p className="text-gray-600 mt-2">
            {isSignUp ? "Crie sua conta de empresa" : "Entre na sua conta"}
          </p>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-md">
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

            {isSignUp && (
              <>
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
              </>
            )}

            <Button
              type="submit"
              className="w-full bg-[#1A1F2C] hover:bg-[#2A303C] text-white"
              disabled={isLoading}
            >
              {isLoading
                ? "Processando..."
                : isSignUp
                ? "Criar conta"
                : "Entrar"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={toggleView}
              className="text-sm text-[#6E59A5] hover:underline"
            >
              {isSignUp
                ? "Já tem uma conta? Entre aqui"
                : "Não tem uma conta? Crie agora"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
