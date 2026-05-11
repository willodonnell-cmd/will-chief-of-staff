"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { type PersonIndex, addRecentlyViewed, getRecentlyViewed } from "@/lib/people-search";

export function RecentlyViewedStrip() {
  const router = useRouter();
  const [people, setPeople] = useState<PersonIndex[]>([]);

  useEffect(() => {
    setPeople(getRecentlyViewed());
  }, []);

  if (people.length === 0) return null;

  function handleClick(person: PersonIndex) {
    addRecentlyViewed(person);
    router.push(`/people/${person.id}`);
  }

  return (
    <section>
      <p
        className="text-text-muted"
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          marginBottom: 10
        }}
      >
        Recently Viewed
      </p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {people.map((person) => (
          <button
            key={person.id}
            type="button"
            onClick={() => handleClick(person)}
            className="shrink-0 rounded-[10px] border border-line/75 bg-white text-left transition-colors hover:bg-[#f0ede8]"
            style={{ width: 160, height: 64, padding: "12px 14px" }}
          >
            <p className="truncate text-[13px] font-medium text-text">{person.name}</p>
            <p className="mt-0.5 truncate text-[11px] text-text-muted">{person.organization}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
