import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        /* Semantic status colors */
        success:
          "border-transparent bg-success/12 text-success hover:bg-success/20 [&.dark]:bg-success/15",
        warning:
          "border-transparent bg-warning/15 text-warning-foreground hover:bg-warning/25",
        info: "border-transparent bg-info/12 text-info hover:bg-info/20 [&.dark]:bg-info/15",
        danger:
          "border-transparent bg-destructive/12 text-destructive hover:bg-destructive/20 [&.dark]:bg-destructive/15",
        neutral:
          "border-transparent bg-muted text-muted-foreground hover:bg-muted/80",
        /* Priority colors */
        priorityLow: "border-transparent bg-muted text-muted-foreground",
        priorityMedium: "border-transparent bg-info/12 text-info [&.dark]:bg-info/15",
        priorityHigh: "border-transparent bg-warning/15 text-warning-foreground",
        priorityCritical: "border-transparent bg-destructive/12 text-destructive [&.dark]:bg-destructive/15",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
