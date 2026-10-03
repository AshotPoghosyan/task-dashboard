import { lazy, Suspense } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { LoginPage } from './features/auth/LoginPage';
import { RequireAuth } from './features/auth/RequireAuth';
import { AccessDeniedPage, SessionExpiredPage } from './features/auth/StatusPages';
import { Skeleton } from './components/ui/Skeleton';

const TasksPage = lazy(() => import('./pages/TasksPage'));
const MergeRequestsPage = lazy(() => import('./pages/MergeRequestsPage'));
const SyncPage = lazy(() => import('./pages/SyncPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
// Dev-only showcase; the build-time DEV constant lets the bundler drop the import in production.
const DevComponents = import.meta.env.DEV ? lazy(() => import('./pages/DevComponents')) : null;

const page = (el: React.ReactNode) => (
  <Suspense fallback={<Skeleton className="h-8 w-48" />}>{el}</Suspense>
);

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/access-denied', element: <AccessDeniedPage /> },
  { path: '/session-expired', element: <SessionExpiredPage /> },
  {
    element: <RequireAuth />,
    children: [
      { index: true, element: page(<TasksPage />) },
      { path: 'merge-requests', element: page(<MergeRequestsPage />) },
      { path: 'sync', element: page(<SyncPage />) },
      { path: 'settings/users', element: page(<UsersPage />) },
      // Dev-only showcase; the guard is a build-time constant so it is tree-shaken from production.
      ...(DevComponents ? [{ path: 'dev/components', element: page(<DevComponents />) }] : []),
    ],
  },
];

export const createRouter = () => createBrowserRouter(routes);
