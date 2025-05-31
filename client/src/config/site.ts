export type SiteConfig = typeof siteConfig;

export type Project = {
  id: string;
  name: string;
  description: string;
  href: string;
};

export type NavItem = {
  label: string;
  href: string;
  icon: string;
  projects?: Project[];
};

export const siteConfig = {
  name: "Vite + HeroUI",
  description: "Make beautiful websites regardless of your design experience.",
  navItems: [
    {
      label: "Home",
      href: "/",
      icon: "home"
    },
    {
      label: "Projects",
      href: "/projects",
      icon: "folder",
      projects: [] // Projects will be loaded dynamically from API
    },
    {
      label: "Database Update",
      href: "/database-update",
      icon: "refresh-cw"
    },
    {
      label: "Docs",
      href: "/docs",
      icon: "book-open"
    },
    {
      label: "Pricing",
      href: "/pricing",
      icon: "tag"
    },
    {
      label: "Blog",
      href: "/blog",
      icon: "rss"
    },
    {
      label: "About",
      href: "/about",
      icon: "info"
    },
  ],
  navMenuItems: [
    {
      label: "Profile",
      href: "/profile",
    },
    {
      label: "Dashboard",
      href: "/dashboard",
    },
    {
      label: "Projects",
      href: "/projects",
    },
    {
      label: "Team",
      href: "/team",
    },
    {
      label: "Calendar",
      href: "/calendar",
    },
    {
      label: "Settings",
      href: "/settings",
    },
    {
      label: "Help & Feedback",
      href: "/help-feedback",
    },
    {
      label: "Logout",
      href: "/logout",
    },
  ],
  links: {
    github: "https://github.com/frontio-ai/heroui",
    twitter: "https://twitter.com/hero_ui",
    docs: "https://heroui.com",
    discord: "https://discord.gg/9b6yyZKmH4",
    sponsor: "https://patreon.com/jrgarciadev",
  },
};
