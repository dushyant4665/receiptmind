import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
  align?: "left" | "center";
  theme?: "light" | "dark";
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  theme = "light",
}: SectionHeadingProps) {
  const dark = theme === "dark";

  return (
    <div className={cn("space-y-2", align === "center" ? "text-center" : "text-left")}>
      <p className={cn("text-[11px] font-medium uppercase tracking-[0.07em]", dark ? "text-text-ghost" : "text-text-ghost")}>
        {eyebrow}
      </p>
      <h2 className={cn("max-w-3xl font-heading text-[26px] leading-[1.2] tracking-[-0.3px]", dark ? "text-text-invert" : "text-text-primary")}>
        {title}
      </h2>
      <p className={cn("max-w-2xl text-[13px] leading-[1.6]", dark ? "text-text-muted" : "text-text-muted")}>
        {description}
      </p>
    </div>
  );
}
