import { StatementWorkbench } from "@/components/statement-workbench";

export const dynamic = "force-dynamic";

export default function Home() {
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.API_URL ??
    "http://localhost:8000";

  return <StatementWorkbench apiBaseUrl={apiBaseUrl} />;
}
