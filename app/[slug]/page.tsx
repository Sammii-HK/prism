import { notFound } from "next/navigation";
import { experiments } from "../lib/registry";
import { ExperimentLayout } from "./experiment-layout";

// Dynamic import map for experiments
const experimentComponents: Record<string, React.ComponentType> = {};

// Lazy-load experiment modules
async function getExperimentComponent(slug: string) {
  try {
    const mod = await import(`../experiments/${slug}`);
    return mod.default;
  } catch {
    return null;
  }
}

export function generateStaticParams() {
  return experiments.map((exp) => ({ slug: exp.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const exp = experiments.find((e) => e.slug === slug);
  if (!exp) return { title: "Not found" };
  return {
    title: `${exp.title} — Prism`,
    description: exp.description,
  };
}

export default async function ExperimentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const exp = experiments.find((e) => e.slug === slug);
  if (!exp) notFound();

  const Component = await getExperimentComponent(slug);
  if (!Component) notFound();

  return (
    <ExperimentLayout experiment={exp}>
      <Component />
    </ExperimentLayout>
  );
}
