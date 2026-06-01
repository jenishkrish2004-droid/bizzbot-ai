import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, Bot, FileUp, LayoutDashboard, LogOut, MessageSquareText, Users } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { ThemeToggle } from "../ui/ThemeToggle";
import { useAuth } from "../../contexts/AuthContext";
import { cn } from "../../utils/cn";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/upload", label: "Upload", icon: FileUp },
  { to: "/chat", label: "Chat", icon: MessageSquareText },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
];

export function AppLayout() {
  const { logout, user } = useAuth();
  const location = useLocation();

  return (
    <div className="app-surface min-h-screen text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border/70 bg-card/72 px-5 py-6 shadow-panel backdrop-blur-2xl lg:block">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-glow">
            <Bot size={22} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold">BizzBot AI</p>
            <p className="text-xs text-muted-foreground">RAG Lead Platform</p>
          </div>
        </div>

        <nav className="mt-8 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition duration-200 hover:bg-muted/80 hover:text-foreground",
                  isActive && "bg-muted text-foreground shadow-soft",
                )
              }
            >
              <item.icon size={18} aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-6 left-5 right-5">
          <div className="glass-panel rounded-lg p-3">
            <p className="truncate text-sm font-semibold">{user?.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            <div className="mt-3 grid grid-cols-[1fr_40px] gap-2">
              <button
                type="button"
                onClick={logout}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border/80 bg-background/60 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <LogOut size={16} aria-hidden="true" />
                Sign out
              </button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </aside>

      <div className="pb-20 lg:pb-0 lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-border/70 bg-background/78 px-4 py-4 shadow-soft backdrop-blur-2xl lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">BizzBot Workspace</p>
              <h1 className="text-xl font-semibold tracking-normal">Document intelligence command center</h1>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle className="lg:hidden" />
              <button
                type="button"
                onClick={logout}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border/80 bg-card/70 px-3 text-xs font-medium text-muted-foreground backdrop-blur-xl transition hover:bg-muted hover:text-foreground lg:hidden"
              >
                <LogOut size={15} aria-hidden="true" />
                Sign out
              </button>
            </div>
          </div>
        </header>
        <main className="px-4 py-6 lg:px-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border/70 bg-card/86 px-2 py-2 shadow-panel backdrop-blur-2xl lg:hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
                isActive && "bg-muted text-foreground shadow-soft",
              )
            }
          >
            <item.icon size={18} aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
