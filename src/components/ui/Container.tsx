import React from "react";

export interface ContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function Container({ children, className = "" }: ContainerProps) {
  return (
    <div className={`mx-auto max-w-[1120px] px-5 md:px-8 ${className}`}>
      {children}
    </div>
  );
}
