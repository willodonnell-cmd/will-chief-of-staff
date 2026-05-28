import { ChiefOfStaffWorkspace } from "@/components/dashboard/chief-of-staff-workspace";
import { PageIntro } from "@/components/shell/page-intro";
import { getChiefOfStaffDashboardData } from "@/lib/chief-of-staff-dashboard";

export default async function TodayPage() {
  const dashboardData = await getChiefOfStaffDashboardData();

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageIntro
        eyebrow="Today"
        title="A calm, source-grounded cockpit for executive attention."
        description="Capture fast, surface narrowly, decide quickly, and remove clutter aggressively. The dashboard stays sparse by design: only what deserves attention now should remain visible."
      />
      <ChiefOfStaffWorkspace data={dashboardData} />
    </div>
  );
}
