import { CrmShell } from "@/components/crm-shell";
import { getCrmShellData } from "@/lib/partnerships/view-model";

export default async function DemoPage() {
  const crmData = await getCrmShellData();

  return (
    <CrmShell
      displayName="Demo User"
      email="demo@ubcbiztech.com"
      data={crmData}
    />
  );
}
