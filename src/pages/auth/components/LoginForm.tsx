import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface LoginFormProps {
  toggleView: () => void;
}

const LoginForm = ({ toggleView }: LoginFormProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { session, userRole, setDirectAuth } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  useEffect(() => {
    if (session && userRole) {
      console.log("[LoginForm] User is authenticated with role:", userRole);
      const redirectPath = userRole === 'admin' ? '/admin/dashboard' : '/dashboard';
      console.log("[LoginForm] Redirecting to:", redirectPath);
      navigate(redirectPath, { replace: true });
    }
  }, [session, userRole, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
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
      
      if (data?.session && data?.role) {
        console.log("[Auth] Setting direct auth with role:", data.role);
        setDirectAuth(data.session, data.role);
        
        const redirectPath = data.role === 'admin' ? '/admin/dashboard' : '/dashboard';
        console.log("[Auth] Redirecting to:", redirectPath);
        navigate(redirectPath, { replace: true });
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

  const handleResetPassword = async () => {
    if (!resetEmail) {
      toast({
        title: "Erro",
        description: "Digite seu email para redefinir a senha",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: "Email enviado",
        description: "Se o email existir em nossa base, você receberá instruções para redefinir sua senha",
      });
      setIsResetDialogOpen(false);
      setResetEmail("");
    } catch (error: any) {
      console.error("[Auth] Password reset error:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar o email de redefinição de senha",
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

        <div className="flex justify-end">
          <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="text-sm text-[#00A868] hover:text-[#008F59] hover:underline"
              >
                Esqueci minha senha
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Redefinir Senha</DialogTitle>
                <DialogDescription>
                  Digite seu email para receber as instruções de redefinição de senha.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label htmlFor="resetEmail" className="text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <Input
                      id="resetEmail"
                      type="email"
                      placeholder="seu@email.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleResetPassword}
                  className="w-full bg-[#00A868] hover:bg-[#008F59] text-white"
                  disabled={isLoading}
                >
                  {isLoading ? "Processando..." : "Enviar instruções"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Button
          type="submit"
          className="w-full bg-[#00A868] hover:bg-[#008F59] text-white"
          disabled={isLoading}
        >
          {isLoading ? "Processando..." : "Entrar"}
        </Button>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={toggleView}
            className="text-sm text-[#00A868] hover:text-[#008F59] hover:underline"
          >
            Não tem uma conta? Crie agora
          </button>
        </div>
      </form>
    </>
  );
};

export default LoginForm;
