import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "emerald";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50 cursor-pointer";
    
    const variants: Record<string, string> = {
      default: "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-500 active:scale-[0.98]",
      destructive: "bg-rose-600 text-white shadow-sm hover:bg-rose-500 active:scale-[0.98]",
      outline: "border border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-800 hover:text-white hover:border-slate-600",
      secondary: "bg-slate-800 text-slate-100 hover:bg-slate-700",
      ghost: "text-slate-300 hover:bg-slate-800/60 hover:text-white",
      link: "text-indigo-400 underline-offset-4 hover:underline",
      emerald: "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 active:scale-[0.98]",
    };

    const sizes: Record<string, string> = {
      default: "h-10 px-4 py-2",
      sm: "h-8 rounded-lg px-3 text-xs",
      lg: "h-12 rounded-xl px-6 text-base font-semibold",
      icon: "h-9 w-9",
    };

    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
