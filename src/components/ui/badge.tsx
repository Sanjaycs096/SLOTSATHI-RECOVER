import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "demo";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants: Record<string, string> = {
    default: "border-transparent bg-indigo-600 text-white shadow hover:bg-indigo-500",
    secondary: "border-transparent bg-slate-800 text-slate-300 hover:bg-slate-700",
    destructive: "border-transparent bg-rose-500/20 text-rose-300 border border-rose-500/30",
    outline: "text-slate-300 border border-slate-700",
    success: "border-transparent bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    warning: "border-transparent bg-amber-500/20 text-amber-300 border border-amber-500/30",
    demo: "border-amber-500/40 bg-amber-950/40 text-amber-300 border font-mono tracking-wider",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
