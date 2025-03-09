
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AuthForm from "./components/AuthForm";

const AuthPage = () => {
  const { session, userRole, isLoading: authLoading } = useAuth();

  // Handle redirects based on auth state and user role
  if (!authLoading && session) {
    console.log("[AuthPage] Redirect check - userRole:", userRole);
    if (userRole === 'admin') {
      return <Navigate to="/admin/dashboard" />;
    } else if (userRole) {
      return <Navigate to="/dashboard" />;
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-[#1A1F2C]">ONE pay</h1>
          <p className="text-gray-600 mt-2">
            <AuthForm />
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
