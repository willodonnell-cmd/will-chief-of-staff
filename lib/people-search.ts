export interface PersonIndex {
  id: string;
  name: string;
  organization: string;
  title?: string;
  currentReadSnippet?: string;
  lastViewed?: number;
}

export const BOOTSTRAP_PEOPLE: PersonIndex[] = [
  {
    id: "1",
    name: "Ninaad Archarya",
    organization: "Fulfillment IQ",
    title: "CEO",
    currentReadSnippet: "First substantive meeting May 11. FIQ building warehouse ops intelligence"
  },
  {
    id: "hamid-moghadam",
    name: "Hamid Moghadam",
    organization: "Prologis",
    title: "Co-Founder & CEO",
    currentReadSnippet: "Long-standing relationship with strategic value at"
  },
  {
    id: "dan-letter",
    name: "Dan Letter",
    organization: "Prologis",
    title: "President",
    currentReadSnippet: "Key operating partner and execution lead at"
  },
  {
    id: "chris-caton",
    name: "Chris Caton",
    organization: "Prologis",
    title: "Global Head of Research",
    currentReadSnippet: "Research and data relationship with insight value"
  }
];

/**
 * Prefix match on first name, last name, and organization.
 * "jo" matches "John", "Jose", "Johnson Capital".
 * Case insensitive.
 */
export function searchPeople(query: string, people: PersonIndex[]): PersonIndex[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  return people.filter((p) => {
    const nameParts = p.name.toLowerCase().split(/\s+/);
    const org = p.organization.toLowerCase();
    return (
      nameParts.some((part) => part.startsWith(q)) ||
      org.startsWith(q) ||
      p.name.toLowerCase().startsWith(q)
    );
  });
}

/** Dedupe by `id`; earlier entries win (e.g. bootstrap before Supabase). */
export function mergePeopleSearchResults(...groups: PersonIndex[][]): PersonIndex[] {
  const seen = new Set<string>();
  const out: PersonIndex[] = [];
  for (const group of groups) {
    for (const p of group) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
    }
  }
  return out;
}

const RECENTLY_VIEWED_KEY = "blackhawk:recently-viewed-people";
const MAX_STORED = 10;
const MAX_SHOWN = 5;

export function getRecentlyViewed(): PersonIndex[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    if (!raw) return [];
    const items: PersonIndex[] = JSON.parse(raw);
    return items.slice(0, MAX_SHOWN);
  } catch {
    return [];
  }
}

export function addRecentlyViewed(person: PersonIndex): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    const existing: PersonIndex[] = raw ? JSON.parse(raw) : [];
    const filtered = existing.filter((p) => p.id !== person.id);
    const updated = [{ ...person, lastViewed: Date.now() }, ...filtered].slice(0, MAX_STORED);
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}
