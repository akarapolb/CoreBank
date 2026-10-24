import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource/ibm-plex-sans-thai/400.css";
import "@fontsource/ibm-plex-sans-thai/600.css";
import "@fabor/ui/styles.css";
import "./app.css";
import { router } from "./router";
import { applyPreferences } from "./lib/preferences";
import { ApiError } from "@fabor/api";

applyPreferences();

const queries = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // a refusal (4xx) will not change on retry; a network blip might
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queries}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
