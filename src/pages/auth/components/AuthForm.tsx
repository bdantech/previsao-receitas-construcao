
import React, { useState } from "react";
import LoginForm from "./LoginForm";
import SignupForm from "./SignupForm";

const AuthForm = () => {
  const [isSignUp, setIsSignUp] = useState(false);

  const toggleView = () => {
    setIsSignUp(!isSignUp);
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-md">
      {isSignUp ? (
        <SignupForm toggleView={toggleView} />
      ) : (
        <LoginForm toggleView={toggleView} />
      )}
    </div>
  );
};

export default AuthForm;
