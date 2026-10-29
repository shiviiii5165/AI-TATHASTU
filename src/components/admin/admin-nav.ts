export interface AdminNavItem {
  title: string;
  href: string;
  iconName: string;
  badge?: string;
  permission?: string;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Operations",
    items: [
      { title: "Overview", href: "/admin", iconName: "LayoutDashboard" },
      { title: "Tickets & Support", href: "/admin/tickets", iconName: "LifeBuoy", badge: "Active" },
      { title: "Academic Catalog", href: "/admin/institutions", iconName: "GraduationCap" },
    ],
  },
  {
    label: "People & Security",
    items: [
      { title: "Student Directory", href: "/admin/students", iconName: "Users" },
      { title: "Admin Team & Roles", href: "/admin/team", iconName: "ShieldCheck" },
      { title: "Security Audit Logs", href: "/admin/logs", iconName: "FileText" },
    ],
  },
  {
    label: "Communications",
    items: [
      { title: "Email Template Studio", href: "/admin/emails/templates", iconName: "Mail" },
      { title: "Delivery Outbox", href: "/admin/emails/deliveries", iconName: "Send" },
      { title: "Email Branding", href: "/admin/emails/settings", iconName: "Palette" },
      { title: "Newsletter & Campaigns", href: "/admin/newsletter", iconName: "Newspaper" },
    ],
  },
  {
    label: "Automation & Growth",
    items: [
      { title: "Rules & SLA Automation", href: "/admin/automation", iconName: "Zap" },
      { title: "Knowledge Base", href: "/admin/kb", iconName: "BookOpen" },
      { title: "Website CMS & Banners", href: "/admin/cms", iconName: "Globe" },
    ],
  },
  {
    label: "Intelligence & Platform",
    items: [
      { title: "AI Providers & Models", href: "/admin/ai-ops/providers", iconName: "Cpu" },
      { title: "AI Costs & Budgets", href: "/admin/ai-ops/costs", iconName: "BarChart3" },
      { title: "Feature Flags", href: "/admin/flags", iconName: "Sliders" },
      { title: "Operational Health", href: "/admin/system", iconName: "Activity" },
    ],
  },
];

