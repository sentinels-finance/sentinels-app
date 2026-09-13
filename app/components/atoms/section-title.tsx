import { cn } from "@/lib/utils";

type SectionTitleProps = {
  icon: string;
  children: React.ReactNode;
  className?: string;
};

export function SectionTitle({ icon, children, className }: SectionTitleProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-sm bg-surface-800 px-2 py-1",
        className,
      )}
    >
      <span className="relative size-5 shrink-0">
        <img alt="" src={icon} className="absolute inset-0 size-full" />
      </span>
      <span className="whitespace-nowrap text-body-md text-white">{children}</span>
    </div>
  );
}
