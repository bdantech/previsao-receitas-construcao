
import React from "react";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

const PageContainer = ({ children, className = "" }: PageContainerProps) => {
  return (
    <div className={`container py-6 max-w-7xl mx-auto ${className}`}>
      {children}
    </div>
  );
};

export default PageContainer;
