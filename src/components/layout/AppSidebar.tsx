"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  BookMarked,
  Search,
  User,
  Menu,
  LogOut,
  Receipt,
  ClipboardList,
  Bell,
  BarChart2,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = "LIBRARIAN" | "MEMBER";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

interface AppSidebarProps {
  role: Role;
  user: {
    name: string;
    email: string;
  };
}

// ── Nav item definitions ──────────────────────────────────────────────────────

const LIBRARIAN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/books", label: "Books", icon: BookOpen },
  { href: "/members", label: "Members", icon: Users },
  { href: "/loans", label: "Loans", icon: BookMarked },
  { href: "/fines", label: "Fines", icon: Receipt },
  { href: "/audit", label: "Audit Log", icon: ClipboardList },
  { href: "/notifications", label: "Notification Log", icon: Bell },
  { href: "/reports", label: "Reports", icon: BarChart2 },
];

const MEMBER_NAV: NavItem[] = [
  { href: "/catalog", label: "Search Catalog", icon: Search },
  { href: "/my-loans", label: "My Loans", icon: BookMarked },
  { href: "/my-reservations", label: "My Reservations", icon: BookOpen },
  { href: "/my-profile", label: "My Profile", icon: User },
];

// ── Nav link component ────────────────────────────────────────────────────────

function NavLink({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;

  if (item.disabled) {
    return (
      <span
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
          "cursor-not-allowed opacity-40 text-slate-500"
        )}
        aria-disabled="true"
        title="Coming soon"
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span>{item.label}</span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "border-l-2 border-slate-900 bg-slate-100 text-slate-900 pl-[10px]"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 flex-shrink-0",
          isActive ? "text-slate-900" : "text-slate-500"
        )}
      />
      <span>{item.label}</span>
    </Link>
  );
}

// ── Sidebar content ───────────────────────────────────────────────────────────

function SidebarContent({
  role,
  user,
  pathname,
  onNavClick,
}: {
  role: Role;
  user: { name: string; email: string };
  pathname: string;
  onNavClick?: () => void;
}) {
  const router = useRouter();
  const navItems = role === "LIBRARIAN" ? LIBRARIAN_NAV : MEMBER_NAV;

  async function handleSignOut() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
        },
      },
    });
  }

  // Derive initials for avatar fallback
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-sm font-semibold text-slate-900">
          Library System
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            isActive={
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href + "/"))
            }
            onClick={onNavClick}
          />
        ))}
      </nav>

      <Separator />

      {/* Footer: user info + sign out */}
      <div className="flex items-center gap-3 px-4 py-4">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">
            {user.name}
          </p>
          <Badge
            variant="outline"
            className="mt-0.5 h-4 px-1 text-[10px] font-normal"
          >
            {role === "LIBRARIAN" ? "Librarian" : "Member"}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSignOut}
          aria-label="Sign out"
          className="h-8 w-8 flex-shrink-0 text-slate-500 hover:text-slate-900"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Main AppSidebar component ─────────────────────────────────────────────────

export function AppSidebar({ role, user }: AppSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar — 240px, always visible at lg+ */}
      <aside className="hidden lg:flex w-60 flex-shrink-0 flex-col border-r bg-white">
        <SidebarContent role={role} user={user} pathname={pathname} />
      </aside>

      {/* Mobile sidebar — hidden below lg, opens as Sheet overlay */}
      <div className="flex lg:hidden">
        {/* Hamburger trigger — visible in app header area */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open navigation"
                className="fixed left-4 top-3 z-40 h-10 w-10 lg:hidden"
              />
            }
          >
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-60 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <SidebarContent
              role={role}
              user={user}
              pathname={pathname}
              onNavClick={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
