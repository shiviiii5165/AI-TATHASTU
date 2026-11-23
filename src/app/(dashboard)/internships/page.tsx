import { ModulePlaceholderPage, placeholderMetadata } from "@/components/dashboard/module-placeholder";

export const metadata = placeholderMetadata("internships");

export default function Page() {
  return <ModulePlaceholderPage module="internships" />;
}
