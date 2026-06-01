import { Slot } from "@radix-ui/react-slot";
import { type ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "../../utils/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: "primary" | "secondary" | "ghost";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild, className, variant = "primary", ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(
          "inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-semibold shadow-soft transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
          variant === "primary" && "bg-primary text-primary-foreground hover:-translate-y-0.5 hover:shadow-glow",
          variant === "secondary" && "border border-border/80 bg-card/78 text-foreground backdrop-blur-xl hover:-translate-y-0.5 hover:bg-muted",
          variant === "ghost" && "text-muted-foreground hover:bg-muted hover:text-foreground",
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
