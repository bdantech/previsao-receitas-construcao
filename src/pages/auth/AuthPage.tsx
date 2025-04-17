import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AuthForm from "./components/AuthForm";

const AuthPage = () => {
  const { session, userRole, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Only redirect if we have a session AND a role
    if (session && userRole) {
      console.log("[AuthPage] User authenticated with role:", userRole);
      if (userRole === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [session, userRole, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="flex justify-center mb-6">
              <img src="/onepay-pro.png" alt="ONE pay Pro" className="h-16" />
            </div>
            <div className="bg-white p-8 rounded-lg shadow-md">
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
              </div>
              <p className="text-center mt-4 text-gray-600">Verificando autenticação...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Login Form (1/3 of the screen) */}
      <div className="w-full lg:w-1/3 flex flex-col justify-center items-center bg-gray-50 p-8">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="flex justify-center mb-6">
              <img src="/onepay-pro.png" alt="ONE pay Pro" className="h-16" />
            </div>
            <AuthForm />
          </div>
        </div>
      </div>

      {/* Right side - Background Image (2/3 of the screen) */}
      <div className="hidden lg:block w-2/3 relative">
        <img
          src="/login-background.jpg"
          alt="Login Background"
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
    </div>
  );
};

export default AuthPage;
