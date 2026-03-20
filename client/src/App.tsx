import { QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { useState } from "react";
import { QueryClient } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../server/routers";
import { DashboardLayout } from "./components/DashboardLayout";
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
        <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#00ff88" }}>
          <DashboardLayout />
          <Toaster
            theme="dark"
            toastOptions={{
              style: {
                background: "#0d1117",
                border: "1px solid #00ff8833",
                color: "#00ff88",
                fontFamily: "Courier New, monospace",
              },
            }}
          />
        </div>
      </trpc.Provider>
    </QueryClientProvider>
  );
}

export default App;
