import { TravelWorkspace } from "@/components/travel/TravelWorkspace";

type PageProps = {
  params: {
    id: string;
  };
};

export default function TravelWorkspacePage({ params }: PageProps) {
  return <TravelWorkspace travelPlanId={params.id} />;
}
