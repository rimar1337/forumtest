import Header from "@/components/Header";
import type { QueryClient } from "@tanstack/react-query";
import {
  Outlet,
  createRootRoute,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { DeltaLogViewer, ReconnectingHeader } from "@/esav/components";
      
export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  component: () => (
    <>
      <Header />
      <ReconnectingHeader />
      <Outlet />
      <TanStackRouterDevtools />
      <ReactQueryDevtools />
      <DeltaLogViewer />
    </>
  ),
});