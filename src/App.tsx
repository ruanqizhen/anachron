import { BrowserRouter, Routes, Route } from 'react-router-dom';
import NavBar from './components/layout/NavBar';
import Home from './pages/Home';
import Board from './pages/Board';
import ThreadPage from './pages/Thread';
import Login from './pages/Login';

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
            <>
              <NavBar />
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/b/:boardSlug" element={<Board />} />
                <Route path="/b/:boardSlug/t/:threadId" element={<ThreadPage />} />
              </Routes>
            </>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
