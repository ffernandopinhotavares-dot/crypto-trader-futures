import { ThemeProvider } from "next-themes";
import { QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { useState } from "react";
import { QueryClient } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../server/routers";
import { DashboardLayout } from "./components/DashboardLayout";
import { ApiKeySetup } from "./pages/ApiKeySetup";
import { Toaster } from "sonner";

// Create TRPC client
export const trpc = createTRPCReact<AppRouter>();

function App() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/trpc",
          transformer: superjson,
        }),
      ],
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <div className="min-h-screen bg-slate-950 text-slate-50">
            <DashboardLayout />
            <Toaster theme="dark" />
          </div>
        </ThemeProvider>
      </trpc.Provider>
    </QueryClientProvider>
  );
}

export default App;
