import { useState } from "react";
import { trpc } from "../App";
import { Sidebar } from "./Sidebar";
import { DashboardPage } from "../pages/Dashboard";
import { ConfigurationPage } from "../pages/Configuration";
import { TradesPage } from "../pages/Trades";
import { ApiKeySetup } from "../pages/ApiKeySetup";
import { SettingsPage } from "../pages/Settings";
import { AlertCircle } from "lucide-react";

type Page = "dashboard" | "configuration" | "trades" | "settings" | "api-setup";

export function DashboardLayout() {
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Check if API keys are configured
  const { data: apiKeys, isLoading } = trpc.bybitKeys.getKeys.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Carregando...</p>
        </div>
      </div>
    );
  }

  // Show API setup if keys not configured
  if (!apiKeys) {
    return <ApiKeySetup />;
  }

  return (
    <div className="flex h-screen bg-slate-950">
      {/* Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Content */}
      <main
        className={`flex-1 overflow-auto transition-all duration-300 ${
          sidebarOpen ? "ml-0" : "ml-0"
        }`}
      >
        <div className="p-6">
          {currentPage === "dashboard" && <DashboardPage />}
          {currentPage === "configuration" && <ConfigurationPage />}
          {currentPage === "trades" && <TradesPage />}
          {currentPage === "settings" && <SettingsPage />}
        </div>
      </main>
    </div>
  );
}
