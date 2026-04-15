import { Redirect } from "expo-router";
import { LoadingScreen } from "@/ui/LoadingScreen";
import { useSession } from "@/session/SessionProvider";
import { useSelectedCompany } from "@/session/SelectedCompanyProvider";

export default function IndexRoute() {
  const { state } = useSession();
  const { loading, activeCompanyId, hasCompanies } = useSelectedCompany();

  if (state === "booting" || loading) {
    return <LoadingScreen text="Preparing USC Mobile..." />;
  }

  if (state === "anonymous") {
    return <Redirect href="/(auth)/login" />;
  }

  if (!hasCompanies) {
    return <Redirect href="/(app)/supplier-gated" />;
  }

  if (!activeCompanyId) {
    return <Redirect href="/(app)/company-picker" />;
  }

  return <Redirect href="/(app)/(tabs)/home" />;
}
