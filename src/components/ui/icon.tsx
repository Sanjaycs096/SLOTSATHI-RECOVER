import React from 'react';

interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  className?: string;
}

export function Icon({ name, className = '', ...props }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined select-none inline-flex items-center justify-center leading-none ${className}`}
      aria-hidden="true"
      {...props}
    >
      {name}
    </span>
  );
}
