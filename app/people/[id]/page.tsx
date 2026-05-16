import { notFound } from "next/navigation";

import { PersonDetailClient } from "@/components/people/person-detail-client";
import { getPersonVaultFromDb } from "@/lib/people-directory";
import { getBootstrapFullPerson } from "@/lib/person-vault";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function PersonPage({ params }: Props) {
  const { id } = await params;
  const person = getBootstrapFullPerson(id) ?? (await getPersonVaultFromDb(id));

  if (!person) notFound();

  return <PersonDetailClient initialPerson={person} />;
}
