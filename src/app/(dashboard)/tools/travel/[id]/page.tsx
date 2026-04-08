import { TravelWorkspace } from "@/components/travel/TravelWorkspace";

type PageProps = {
  params: {
    id: string;
  };
};

export const dynamic = "force-dynamic";

export default function TravelWorkspacePage({ params }: PageProps) {
  return <TravelWorkspace travelPlanId={params.id} />;
}
