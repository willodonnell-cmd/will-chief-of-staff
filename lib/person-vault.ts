import { BOOTSTRAP_PEOPLE, type PersonIndex } from "@/lib/people-search";

export interface Person {
  id: string;
  name: string;
  organization: string;
  title: string;
  category: "internal" | "external" | "investment" | "ecosystem";
  current_read: string | null;
  open_loops: Array<{
    direction: "i_owe" | "they_owe";
    text: string;
    by_when?: string;
  }>;
  recent_interactions: Array<{
    date: string;
    context: string;
    what_changed: string;
  }>;
  last_researched: string | null;
  linked_investment_page?: string | null;
  privacy: "personal" | "business" | "sensitive";
}

export const RESEARCH_TEST_PERSON: Person = {
  id: "1",
  name: "Ninaad Archarya",
  organization: "Fulfillment IQ",
  title: "CEO",
  category: "investment",
  current_read:
    "First substantive meeting May 11. FIQ building warehouse ops intelligence aligned with Prologis data thesis. Serious operators. Potential corp dev target within 12 months.",
  open_loops: [
    {
      direction: "they_owe",
      text: "Send Technology Alignment presentation for Prologis review"
    },
    {
      direction: "i_owe",
      text: "Share Prologis tech standards doc once next version ready"
    }
  ],
  recent_interactions: [
    {
      date: "2026-05-11",
      context: "Zoom meeting",
      what_changed:
        "First substantive meeting. FIQ-Prologis technology alignment discussed. Multiple open loops created."
    }
  ],
  last_researched: null,
  privacy: "sensitive"
};

function fromIndex(p: PersonIndex): Person {
  return {
    id: p.id,
    name: p.name,
    organization: p.organization,
    title: p.title ?? "",
    category: "internal",
    current_read: p.currentReadSnippet
      ? `${p.currentReadSnippet} ${p.organization}.`
      : null,
    open_loops: [],
    recent_interactions: [],
    last_researched: null,
    privacy: "business"
  };
}

export function getBootstrapFullPerson(id: string): Person | null {
  if (id === RESEARCH_TEST_PERSON.id) {
    return { ...RESEARCH_TEST_PERSON };
  }
  const idx = BOOTSTRAP_PEOPLE.find((p) => p.id === id);
  if (!idx) return null;
  return fromIndex(idx);
}
