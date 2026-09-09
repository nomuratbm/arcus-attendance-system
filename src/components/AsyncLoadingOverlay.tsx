import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type AsyncLoadingOverlayProps = {
  label: string;
  className?: string;
};

export function AsyncLoadingOverlay({
  label,
  className,
}: AsyncLoadingOverlayProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-20 flex cursor-wait items-center justify-center rounded-[inherit] bg-background/80 backdrop-blur-[1px]",
        className,
      )}
      role="status"
    >
      <span className="flex items-center gap-2 rounded-lg border bg-popover px-3 py-2 text-sm font-medium shadow-sm">
        <Spinner aria-hidden="true" />
        {label}
      </span>
    </div>
  );
}
