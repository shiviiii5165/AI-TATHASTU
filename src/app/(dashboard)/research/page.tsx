import { ModulePlaceholderPage, placeholderMetadata } from "@/components/dashboard/module-placeholder";

export const metadata = placeholderMetadata("research");

export default function Page() {
  return <ModulePlaceholderPage module="research" />;
}
