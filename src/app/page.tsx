import { StatementWorkbench } from "@/components/statement-workbench";

export const dynamic = "force-dynamic";

export default function Home() {
  const apiBaseUrl = "/api/backend";

  return <StatementWorkbench apiBaseUrl={apiBaseUrl} />;
}
