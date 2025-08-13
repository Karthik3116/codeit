import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import ContestLobby from './pages/ContestLobby'; // Import new lobby page
import ContestRoom from './pages/ContestRoom';
import useAuth from './hooks/useAuth';

function App() {
  const { user } = useAuth();

  const PrivateRoute = ({ children }) => {
    return user ? children : <Navigate to="/login" />;
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
          <Route path="/signup" element={!user ? <Signup /> : <Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/contest/:roomId/lobby" element={<PrivateRoute><ContestLobby /></PrivateRoute>} />
          <Route path="/contest/:roomId" element={<PrivateRoute><ContestRoom /></PrivateRoute>} />
        </Routes>
      </main>
    </div>
  );
}

export default App;