
import React from "react";
import { RefreshCw } from "lucide-react";

interface HeaderWithButtonsProps {
  title: string;
  description?: string;
  loading?: boolean;
  children?: React.ReactNode;
}

const HeaderWithButtons = ({
  title,
  description,
  loading = false,
  children,
}: HeaderWithButtonsProps) => {
  return (
    <div className="flex justify-between items-start mb-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {title}
          {loading && (
            <RefreshCw className="inline-block ml-2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </h1>
        {description && (
          <p className="text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      <div className="flex items-center space-x-2">{children}</div>
    </div>
  );
};

export default HeaderWithButtons;
