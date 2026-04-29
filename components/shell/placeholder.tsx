import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Construction } from "lucide-react";

function makePlaceholder(title: string, description: string) {
  return function Placeholder() {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground mt-1">{description}</p>
        </div>
        <Card className="border-dashed">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Construction className="h-5 w-5 text-warning" />
              <CardTitle className="text-base">Module scaffolded</CardTitle>
            </div>
            <CardDescription>
              This module is part of Phase 2. Ask Lovable to "build out the {title} module" to flesh it out
              with full interactivity, drag-and-drop, forms, and real-data persistence.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Database tables and RLS policies are already in place. The UI for this module will be built next.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  };
}

export { makePlaceholder };
