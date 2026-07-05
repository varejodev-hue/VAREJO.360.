import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function HelpTip({
  title,
  text,
  className,
}: {
  title?: string;
  text: string;
  className?: string;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground",
              className,
            )}
            aria-label={title ? `Ajuda: ${title}` : "Ajuda"}
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" className="max-w-xs bg-popover text-popover-foreground border shadow-md">
          {title && <div className="font-semibold mb-1">{title}</div>}
          <div className="leading-relaxed">{text}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
