import {
  LayoutDashboard,
  TrendingUp,
  Settings,
  List,
  FileText,
  AlertTriangle,
  ShieldCheck,
  Zap,
  Menu,
  X,
  SlidersHorizontal,
  Radio,
} from "lucide-react";

type Page = "dashboard" | "futures" | "monitor" | "configuration" | "trades" | "logs" | "corrections" | "admin" | "settings" | "api-setup";

interface SidebarProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const menuItems = [
  { id: "monitor" as Page, label: "Monitor", icon: Radio },
  { id: "dashboard" as Page, label: "Dashboard", icon: LayoutDashboard },
  { id: "futures" as Page, label: "Futuros", icon: TrendingUp },
  { id: "configuration" as Page, label: "Configuração", icon: Settings },
  { id: "trades" as Page, label: "Trades", icon: List },
  { id: "logs" as Page, label: "Logs", icon: FileText },
  { id: "corrections" as Page, label: "Correções", icon: AlertTriangle },
  { id: "admin" as Page, label: "Admin", icon: ShieldCheck },
  { id: "settings" as Page, label: "Configurações", icon: SlidersHorizontal },
];

export function Sidebar({ currentPage, onPageChange, isOpen, onToggle }: SidebarProps) {
  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={onToggle}
        className="fixed top-3 left-3 z-50 lg:hidden p-2 rounded"
        style={{ background: "#0d1117", border: "1px solid #00ff8820", color: "#00ff88" }}
      >
        {isOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Sidebar */}
      <aside
        style={{
          width: "180px",
          minWidth: "180px",
          background: "#080b10",
          borderRight: "1px solid #00ff8815",
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 40,
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease",
        }}
        className="lg:relative lg:translate-x-0"
      >
        {/* Logo */}
        <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid #00ff8812" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Zap size={18} style={{ color: "#00ff88" }} />
            <span style={{ fontWeight: "700", fontSize: "15px", color: "#00ff88", letterSpacing: "0.5px" }}>
              CryptoBot
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: "12px 0" }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onPageChange(item.id);
                  if (window.innerWidth < 1024) onToggle();
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 16px",
                  background: isActive ? "#00ff8812" : "transparent",
                  color: isActive ? "#00ff88" : "#4a7a5a",
                  fontSize: "13px",
                  fontFamily: "Courier New, monospace",
                  fontWeight: isActive ? "600" : "400",
                  cursor: "pointer",
                  borderLeft: isActive ? "3px solid #00ff88" : "3px solid transparent",
                  transition: "all 0.15s ease",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.color = "#00ff88aa";
                    (e.currentTarget as HTMLButtonElement).style.background = "#00ff8808";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.color = "#4a7a5a";
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }
                }}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Version */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid #00ff8812" }}>
          <p style={{ fontSize: "10px", color: "#2a4a3a", fontFamily: "Courier New, monospace" }}>
            v1.0.0 • Trading Bot
          </p>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={onToggle}
        />
      )}
    </>
  );
}
