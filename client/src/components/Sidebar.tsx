import {
  BarChart3,
  Settings,
  TrendingUp,
  Menu,
  X,
  Zap,
  LogOut,
} from "lucide-react";
import { Button } from "./ui/button";

type Page = "dashboard" | "configuration" | "trades" | "settings" | "api-setup";

interface SidebarProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({
  currentPage,
  onPageChange,
  isOpen,
  onToggle,
}: SidebarProps) {
  const menuItems = [
    {
      id: "dashboard" as Page,
      label: "Dashboard",
      icon: BarChart3,
    },
    {
      id: "configuration" as Page,
      label: "Configuração",
      icon: Settings,
    },
    {
      id: "trades" as Page,
      label: "Operações",
      icon: TrendingUp,
    },
    {
      id: "settings" as Page,
      label: "Configurações",
      icon: Zap,
    },
  ];

  return (
    <>
      {/* Mobile Toggle */}
      <div className="fixed top-4 left-4 z-50 lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="text-slate-400 hover:text-slate-200"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed lg:relative w-64 h-screen bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 z-40 ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Zap size={20} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">CryptoTrader</h1>
          </div>
          <p className="text-xs text-slate-500 mt-2">Trading Bot Automático</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onPageChange(item.id);
                  // Close sidebar on mobile after selection
                  if (window.innerWidth < 1024) {
                    onToggle();
                  }
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                <Icon size={20} />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all">
            <LogOut size={20} />
            <span className="text-sm font-medium">Sair</span>
          </button>
          <p className="text-xs text-slate-600 text-center mt-4">
            v1.0.0 • Trading Bot
          </p>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onToggle}
        />
      )}
    </>
  );
}
