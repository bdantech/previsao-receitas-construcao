import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

const AdminAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { session, userRole, setDirectAuth } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  // If already logged in as admin, redirect to admin dashboard
  if (session && userRole === 'admin') {
    return <Navigate to="/admin/dashboard" />;
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { email, password } = formData;
      
      if (!email || !password) {
        toast({
          title: "Erro",
          description: "Preencha email e senha",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // First, let's create our first admin if it doesn't exist yet
      try {
        await supabase.functions.invoke('create-first-admin');
      } catch (error) {
        console.log("Create first admin check complete");
      }

      // Use the auth function instead of admin-login
      const { data, error } = await supabase.functions.invoke('auth', {
        body: {
          action: 'login',
          email,
          password
        }
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Check if user has admin role
      if (data?.role !== 'admin') {
        throw new Error("Acesso negado: Apenas administradores podem acessar este portal");
      }

      toast({
        title: "Login bem-sucedido",
        description: "Você entrou com sucesso na sua conta de administrador",
      });
      
      // Set direct auth with session and role
      if (data?.session && data?.role) {
        await setDirectAuth(data.session, data.role);
        navigate("/admin/dashboard");
      }
    } catch (error: any) {
      console.error("Admin auth error:", error);
      toast({
        title: "Erro",
        description: error.message || "Acesso negado. Apenas administradores podem entrar nesta área.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Background Image (2/3 of the screen) */}
      <div className="hidden lg:block w-2/3 relative">
        <img
          src="/login-background.jpg"
          alt="Login Background"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Gradient overlay */}
        <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-black/70 to-transparent" />
        {/* Text overlay */}
        <div className="absolute top-12 left-0 right-0 text-center">
          <p className="text-white text-4xl font-medium px-8 leading-normal">
            Antecipando o Futuro<br />para quem Constrói o Brasil
          </p>
        </div>
      </div>

      {/* Right side - Login Form (1/3 of the screen) */}
      <div className="w-full lg:w-1/3 flex flex-col justify-center items-center bg-gray-50 p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="flex flex-col items-center gap-2 mb-6">
              <img src="/onepay-pro.png" alt="ONE pay Pro" className="h-12" />
              <span className="text-sm font-medium text-gray-500">ADMIN</span>
            </div>
          </div>

          <div className="bg-white p-8 rounded-lg shadow-md">
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
                    placeholder="admin@email.com"
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

              <Button
                type="submit"
                className="w-full bg-[#00A868] hover:bg-[#008F59] text-white"
                disabled={isLoading}
              >
                {isLoading ? "Processando..." : "Entrar como Admin"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAuth;
