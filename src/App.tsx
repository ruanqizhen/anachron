import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import NavBar from './components/layout/NavBar';
import ErrorBoundary from './components/layout/ErrorBoundary';
import AdminLayout from './components/layout/AdminLayout';

// Lazy load pages
const Home = lazy(() => import('./pages/Home'));
const Board = lazy(() => import('./pages/Board'));
const ThreadPage = lazy(() => import('./pages/Thread'));
const Login = lazy(() => import('./pages/Login'));
const Notifications = lazy(() => import('./pages/Notifications'));
const UserBlog = lazy(() => import('./pages/UserBlog'));
const Characters = lazy(() => import('./pages/Characters'));
const Search = lazy(() => import('./pages/Search'));
const Settings = lazy(() => import('./pages/Settings'));

// Lazy load admin pages
const AdminModeration = lazy(() => import('./pages/admin/Moderation'));
const AdminIpRisks = lazy(() => import('./pages/admin/IpRisks'));
const AdminCharacters = lazy(() => import('./pages/admin/Characters'));
const AdminCharacterEdit = lazy(() => import('./pages/admin/CharacterEdit'));
const AdminTasks = lazy(() => import('./pages/admin/Tasks'));
const AdminStats = lazy(() => import('./pages/admin/Stats'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminBoards = lazy(() => import('./pages/admin/Boards'));

const LoadingFallback = () => (
  <div className="flex justify-center items-center h-screen" style={{ color: 'var(--color-text-muted)' }}>
    加载中...
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Login page has its own layout (no NavBar) */}
          <Route path="/login" element={<Login />} />

          {/* Main layout with NavBar */}
          <Route
            path="*"
            element={
              <ErrorBoundary>
                <NavBar />
                <Suspense fallback={<LoadingFallback />}>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/b/:boardSlug" element={<Board />} />
                    <Route path="/b/:boardSlug/t/:threadId" element={<ThreadPage />} />
                    <Route path="/notifications" element={<Notifications />} />
                    <Route path="/u/:username" element={<UserBlog />} />
                    <Route path="/characters" element={<Characters />} />
                    <Route path="/admin" element={<AdminLayout />}>
                      <Route index element={<AdminCharacters />} />
                      <Route path="moderation" element={<AdminModeration />} />
                      <Route path="ip-risks" element={<AdminIpRisks />} />
                      <Route path="characters" element={<AdminCharacters />} />
                      <Route path="characters/:id" element={<AdminCharacterEdit />} />
                      <Route path="tasks" element={<AdminTasks />} />
                      <Route path="stats" element={<AdminStats />} />
                      <Route path="users" element={<AdminUsers />} />
                      <Route path="boards" element={<AdminBoards />} />
                    </Route>
                    <Route path="/search" element={<Search />} />
                    <Route path="/settings" element={<Settings />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
