import { cn } from "@/utils/cn";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-md bg-slate-200/80 dark:bg-slate-800/80",
        className,
      )}
      {...props}
    />
  );
}
