import type { RegistryItem } from './registry';
export type Availability = 'all' | 'installable' | 'study';
export function discoverComponents(items: RegistryItem[], category: string, query: string, availability: Availability, installable: Set<string>) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return items.filter(item => (category === 'all' || item.category === category)
    && (availability === 'all' || (availability === 'installable' ? installable.has(item.slug) : item.type === 'study'))
    && words.every(word => [item.title, item.description, item.tagline ?? '', ...item.tags].join(' ').toLowerCase().includes(word)))
    .sort((a,b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}
