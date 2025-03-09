
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AuthForm from "./components/AuthForm";

const AuthPage = () => {
  const { session, userRole, isLoading } = useAuth();

  // Only redirect if we have a session AND a role
  if (!isLoading && session && userRole) {
    console.log("[AuthPage] Redirecting user with role:", userRole);
    if (userRole === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    } else {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-[#1A1F2C]">ONE pay</h1>
          <AuthForm />
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
