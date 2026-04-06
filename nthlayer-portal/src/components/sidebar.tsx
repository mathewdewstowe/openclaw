"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const link = (href: string, label: string, icon: React.ReactNode) => {
    const active = pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
    return (
      <Link
        href={href}
        className={`flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
          active
            ? "bg-emerald-50 text-emerald-700"
            : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
        }`}
      >
        <span className={`shrink-0 ${active ? "text-emerald-600" : "text-gray-400"}`}>{icon}</span>
        {label}
      </Link>
    );
  };

  const iconBuilding = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  );
  const iconList = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  );
  const iconPlus = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
  const iconNews = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-4.5 5.25h4.5m2.25 2.25H6.75A2.25 2.25 0 014.5 15.75V5.25A2.25 2.25 0 016.75 3h5.586a1.5 1.5 0 011.06.44l3.415 3.414a1.5 1.5 0 01.439 1.061V15.75A2.25 2.25 0 0115 18h-4.5" />
    </svg>
  );
  const iconLink = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
    </svg>
  );
  const iconCog = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );

  const divider = <div className="my-2 border-t border-gray-100" />;
  const sectionLabel = (label: string) => (
    <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
  );

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-56 border-r border-gray-200 bg-white flex flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-100">
        {/* Nth Layer concentric-squares logo */}
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-900">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Outermost square */}
            <rect x="1" y="1" width="18" height="18" stroke="white" strokeWidth="1.5" fill="none"/>
            {/* Second square, rotated 11deg */}
            <rect x="4" y="4" width="12" height="12" stroke="white" strokeWidth="1.2" fill="none" transform="rotate(11 10 10)"/>
            {/* Third square, rotated 22deg */}
            <rect x="6.5" y="6.5" width="7" height="7" stroke="white" strokeWidth="1" fill="none" transform="rotate(22 10 10)"/>
            {/* Inner square, rotated 33deg */}
            <rect x="8.5" y="8.5" width="3" height="3" stroke="white" strokeWidth="0.9" fill="none" transform="rotate(33 10 10)"/>
          </svg>
        </div>
        <div>
          <div className="text-[13px] font-bold text-gray-900 leading-tight">Nth Layer</div>
          <div className="text-[10px] text-gray-400 leading-tight">Signal Portal</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {link("/company", "Your Company", iconBuilding)}
        {divider}
        {sectionLabel("Intelligence")}
        {link("/dashboard", "Competitor Teardowns", iconList)}
        {link("/scan/competitor/new", "New Teardown", iconPlus)}
        {link("/news", "Competitor News", iconNews)}
        {divider}
        {sectionLabel("Account")}
        {link("/integrations", "Integrations", iconLink)}
        {link("/settings", "Settings", iconCog)}
        {role === "ADMIN" && (
          <>
            {divider}
            {link("/admin", "Admin", iconCog)}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-[13px] text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}
