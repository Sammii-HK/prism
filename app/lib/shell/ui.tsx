import type { ReactNode } from "react";

/**
 * Layout primitives for the site shell. Every page shares one measure, one
 * gutter and one rhythm, so the components are what changes from page to page.
 */

export const Container = ({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "header" | "footer" | "nav";
}) => <Tag className={`mx-auto w-full max-w-6xl px-5 sm:px-8 ${className}`}>{children}</Tag>;

/** Small mono label that sits above a heading. */
export const Eyebrow = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <p className={`font-mono text-[11px] uppercase tracking-[0.22em] text-white/50 ${className}`}>{children}</p>
);

/** Section opener: eyebrow, heading and an optional line of context or action on the right. */
export const SectionHeading = ({
  eyebrow,
  title,
  aside,
  id,
}: {
  eyebrow: string;
  title: ReactNode;
  aside?: ReactNode;
  id?: string;
}) => (
  <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <Eyebrow className="mb-3">{eyebrow}</Eyebrow>
      <h2 id={id} className="text-[28px] font-light leading-[1.1] tracking-[-0.02em] text-white/90 sm:text-4xl">
        {title}
      </h2>
    </div>
    {aside && <div className="shrink-0 text-sm text-white/55">{aside}</div>}
  </div>
);

/** A hairline that spans the measure, used between sections instead of boxes. */
export const Rule = () => (
  <Container>
    <div className="h-px w-full bg-gradient-to-r from-transparent via-white/[0.09] to-transparent" />
  </Container>
);
