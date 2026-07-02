import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  body,
  icon,
  action,
  className,
}: {
  title: string;
  body?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 py-12 text-center", className)}>
      {icon && (
        <span className="grid size-11 place-items-center rounded-xl bg-secondary text-muted-foreground">
          {icon}
        </span>
      )}
      <p className="font-medium">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
