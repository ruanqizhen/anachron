import { BrowserRouter, Routes, Route } from 'react-router-dom';
import NavBar from './components/layout/NavBar';
import ErrorBoundary from './components/layout/ErrorBoundary';
import Home from './pages/Home';
import Board from './pages/Board';
import ThreadPage from './pages/Thread';
import Login from './pages/Login';
import Notifications from './pages/Notifications';
import UserBlog from './pages/UserBlog';
import Characters from './pages/Characters';
import AdminModeration from './pages/admin/Moderation';
import AdminIpRisks from './pages/admin/IpRisks';
import AdminCharacters from './pages/admin/Characters';
import AdminCharacterEdit from './pages/admin/CharacterEdit';
import AdminTasks from './pages/admin/Tasks';
import AdminStats from './pages/admin/Stats';
import Settings from './pages/Settings';
import Search from './pages/Search';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login page has its own layout (no NavBar) */}
        <Route path="/login" element={<Login />} />

        {/* Main layout with NavBar */}
        <Route
          path="*"
          element={
            <ErrorBoundary>
              <NavBar />
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/b/:boardSlug" element={<Board />} />
                <Route path="/b/:boardSlug/t/:threadId" element={<ThreadPage />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/u/:username" element={<UserBlog />} />
                <Route path="/characters" element={<Characters />} />
                <Route path="/admin/moderation" element={<AdminModeration />} />
                <Route path="/admin/ip-risks" element={<AdminIpRisks />} />
                <Route path="/admin/characters" element={<AdminCharacters />} />
                <Route path="/admin/characters/:id" element={<AdminCharacterEdit />} />
                <Route path="/admin/tasks" element={<AdminTasks />} />
                <Route path="/admin/stats" element={<AdminStats />} />
                <Route path="/search" element={<Search />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </ErrorBoundary>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
