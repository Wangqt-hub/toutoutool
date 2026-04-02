import { RestoreSessionScreen } from "@/components/auth/restore-session-screen";

export default function AuthRestorePage({
  searchParams,
}: {
  searchParams?: {
    to?: string;
  };
}) {
  return <RestoreSessionScreen to={searchParams?.to} />;
}
