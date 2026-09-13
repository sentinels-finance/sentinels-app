import { SectionTitle } from "@/components/atoms/section-title";

type SectionHeaderProps = {
  badgeIcon?: string;
  badge?: string;
  title: React.ReactNode;
  description: string;
};

export function SectionHeader({ badgeIcon, badge, title, description }: SectionHeaderProps) {
  return (
    <div className="flex w-full flex-col items-center gap-6 text-center">
      {badge && badgeIcon && <SectionTitle icon={badgeIcon}>{badge}</SectionTitle>}
      <div className="flex w-full flex-col items-center gap-3">
        <h2 className="w-full bg-heading-gradient bg-clip-text text-[32px] font-semibold leading-[40px] tracking-[-0.03em] text-transparent md:text-h3">
          {title}
        </h2>
        <p className="w-full text-body-md text-soft-300">{description}</p>
      </div>
    </div>
  );
}
