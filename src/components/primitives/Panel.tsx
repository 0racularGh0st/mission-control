import type React from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PanelProps = React.ComponentProps<typeof Card> & {
  title?: string;
  description?: string;
};

export function Panel({
  className,
  title,
  description,
  children,
  ...props
}: PanelProps) {
  return (
    <Card className={cn("border-border/80 bg-card/80", className)} {...props}>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  );
}
