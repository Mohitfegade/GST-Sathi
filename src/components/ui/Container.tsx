import React from "react";

export interface ContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function Container({ children, className = "" }: ContainerProps) {
  return (
    <div className={`max-w-[1120px] px-5 md:px-8 mx-auto ${className}`.trim()}>
      {children}
    </div>
  );
}

export default Container;
