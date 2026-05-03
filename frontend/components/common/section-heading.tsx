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
      <p className={cn("text-[10px] font-bold uppercase tracking-widest text-amber")}>
        {eyebrow}
      </p>
      <h2 className={cn("max-w-3xl font-heading text-[24px] leading-[1.2] tracking-tight", dark ? "text-white" : "text-text-primary")}>
        {title}
      </h2>
      <p className={cn("max-w-2xl text-[13px] leading-relaxed text-text-muted")}>
        {description}
      </p>
    </div>
  );
}
