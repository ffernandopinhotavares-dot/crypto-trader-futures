import { useState, useEffect } from "react";
import { trpc } from "../App";
import { Sidebar } from "./Sidebar";
import { DashboardPage } from "../pages/Dashboard";
import { ConfigurationPage } from "../pages/Configuration";
import { TradesPage } from "../pages/Trades";
import { ApiKeySetup } from "../pages/ApiKeySetup";
import { SettingsPage } from "../pages/Settings";
import { LogsPage } from "../pages/Logs";
import { FuturesPage } from "../pages/Futures";
import { MonitorPage } from "../pages/Monitor";
import { LogAnalysisPage } from "../pages/LogAnalysis";
import { RefreshCw, Power } from "lucide-react";

type Page = "dashboard" | "futures" | "monitor" | "configuration" | "trades" | "logs" | "log-analysis" | "corrections" | "admin" | "settings" | "api-setup";

function useCurrentTime() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString("pt-BR", { hour12: false }));
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString("pt-BR", { hour12: false }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  return time;
}

export function DashboardLayout() {
  const [currentPage, setCurrentPage] = useState<Page>("monitor");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const currentTime = useCurrentTime();

  const { data: apiKeys, isLoading } = trpc.gateioKeys.getKeys.useQuery();
  const { data: botStatus } = trpc.botControl.getStatus.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const { mutate: stopBot } = trpc.botControl.stop.useMutation();
  const { data: configs } = trpc.tradingConfig.getAll.useQuery();

  const isRunning = botStatus?.isRunning ?? false;

  if (isLoading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "100vh", background: "#0a0a0f",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "40px", height: "40px", border: "2px solid #00ff8833",
            borderTop: "2px solid #00ff88", borderRadius: "50%",
            animation: "spin 1s linear infinite", margin: "0 auto 16px",
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: "#00ff8866", fontFamily: "Courier New, monospace", fontSize: "13px" }}>
            Carregando...
          </p>
        </div>
      </div>
    );
  }

  if (!apiKeys) {
    return <ApiKeySetup />;
  }

  const pageTitles: Record<Page, string> = {
    monitor: "CryptoTrader",
    dashboard: "CryptoTrader",
    futures: "CryptoTrader",
    configuration: "CryptoTrader",
    trades: "CryptoTrader",
    logs: "CryptoTrader",
    "log-analysis": "CryptoTrader",
    corrections: "CryptoTrader",
    admin: "CryptoTrader",
    settings: "CryptoTrader",
    "api-setup": "CryptoTrader",
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0a0a0f", overflow: "hidden" }}>
      {/* Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main area */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        marginLeft: sidebarOpen ? "180px" : "0",
        transition: "margin-left 0.25s ease",
      }}
        className="lg:ml-0"
      >
        {/* Top bar */}
        <header style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          height: "52px",
          background: "#080b10",
          borderBottom: "1px solid #00ff8815",
          flexShrink: 0,
        }}>
          {/* Left: title + status */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <span style={{
              fontSize: "18px", fontWeight: "700", color: "#00ff88",
              fontFamily: "Courier New, monospace", letterSpacing: "1px",
            }}>
              CryptoTrader
            </span>
            <span style={{
              fontSize: "11px", padding: "2px 8px", borderRadius: "4px",
              background: isRunning ? "#00ff8820" : "#ff446620",
              color: isRunning ? "#00ff88" : "#ff4466",
              border: `1px solid ${isRunning ? "#00ff8840" : "#ff446640"}`,
              fontFamily: "Courier New, monospace",
              fontWeight: "600",
            }}>
              {isRunning ? "● ATIVO" : "○ PARADO"}
            </span>
            {isRunning && (
              <span style={{
                fontSize: "11px", color: "#00ff88",
                fontFamily: "Courier New, monospace",
                display: "flex", alignItems: "center", gap: "4px",
              }}>
                <span className="blink" style={{
                  width: "7px", height: "7px", borderRadius: "50%",
                  background: "#00ff88", display: "inline-block",
                }} />
                AO VIVO
              </span>
            )}
          </div>

          {/* Right: clock + stop button */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{
              fontSize: "14px", color: "#00ff8888",
              fontFamily: "Courier New, monospace", letterSpacing: "1px",
            }}>
              {currentTime}
            </span>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                color: "#00ff8866", padding: "4px",
              }}
              title="Atualizar"
            >
              <RefreshCw size={15} />
            </button>
            {isRunning && (
              <button
                onClick={() => stopBot()}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "5px 12px", borderRadius: "4px",
                  background: "#ff446615", border: "1px solid #ff446640",
                  color: "#ff4466", fontSize: "12px",
                  fontFamily: "Courier New, monospace", fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                <Power size={13} />
                Parar Bot
              </button>
            )}
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflow: "auto", padding: "20px 24px" }}>
          {currentPage === "dashboard" && <DashboardPage onStartBot={() => {}} />}
          {currentPage === "futures" && <FuturesPage />}
          {currentPage === "monitor" && <MonitorPage />}
          {currentPage === "configuration" && <ConfigurationPage />}
          {currentPage === "trades" && <TradesPage />}
          {currentPage === "logs" && <LogsPage />}
          {currentPage === "log-analysis" && <LogAnalysisPage />}
          {currentPage === "corrections" && (
            <PlaceholderPage title="Correções" />
          )}
          {currentPage === "admin" && (
            <PlaceholderPage title="Admin" />
          )}
          {currentPage === "settings" && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <p style={{ color: "#00ff8844", fontFamily: "Courier New, monospace", fontSize: "14px" }}>
        {title} — Em breve
      </p>
    </div>
  );
}
