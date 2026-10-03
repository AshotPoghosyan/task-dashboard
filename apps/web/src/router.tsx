import { lazy, Suspense } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { LoginPage } from './features/auth/LoginPage';
import { RequireAuth } from './features/auth/RequireAuth';
import { Skeleton } from './components/ui/Skeleton';

const TasksPage = lazy(() => import('./pages/TasksPage'));
const MergeRequestsPage = lazy(() => import('./pages/MergeRequestsPage'));
const SyncPage = lazy(() => import('./pages/SyncPage'));
// Dev-only showcase; the build-time DEV constant lets the bundler drop the import in production.
const DevComponents = import.meta.env.DEV ? lazy(() => import('./pages/DevComponents')) : null;

const page = (el: React.ReactNode) => (
  <Suspense fallback={<Skeleton className="h-8 w-48" />}>{el}</Suspense>
);

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      { index: true, element: page(<TasksPage />) },
      { path: 'merge-requests', element: page(<MergeRequestsPage />) },
      { path: 'sync', element: page(<SyncPage />) },
      // Dev-only showcase; the guard is a build-time constant so it is tree-shaken from production.
      ...(DevComponents ? [{ path: 'dev/components', element: page(<DevComponents />) }] : []),
    ],
  },
];

export const createRouter = () => createBrowserRouter(routes);
