import { render } from "solid-js/web";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import App from "./App";
// @ts-expect-error — no type declarations needed for font side-effect import
import "@fontsource-variable/manrope";
import "./index.css";

const queryClient = new QueryClient();

queryClient.setQueryDefaults(["categories"], {
  staleTime: Infinity,
  gcTime: 30 * 60 * 1000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
});

queryClient.setQueryDefaults(["invitations"], {
  staleTime: 30 * 1000,
  gcTime: 30 * 60 * 1000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
});

render(
  () => (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  ),
  document.getElementById("root")!,
);
