import { StatementWorkbench } from "@/components/statement-workbench";

export const dynamic = "force-dynamic";

export default function AnalyzerPage() {
  return <StatementWorkbench apiBaseUrl="/api/backend" />;
}
