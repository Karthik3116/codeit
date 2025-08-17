// import { Routes, Route, Navigate } from 'react-router-dom';
// import Header from './components/Header';
// import Home from './pages/Home';
// import Login from './pages/Login';
// import Signup from './pages/Signup';
// import Dashboard from './pages/Dashboard';
// import ContestLobby from './pages/ContestLobby'; // Import new lobby page
// import ContestRoom from './pages/ContestRoom';
// import useAuth from './hooks/useAuth';

// function App() {
//   const { user } = useAuth();

//   const PrivateRoute = ({ children }) => {
//     return user ? children : <Navigate to="/login" />;
//   };

//   return (
//     <div className="min-h-screen">
//       <Header />
//       <main className="container mx-auto px-4 py-8">
//         <Routes>
//           <Route path="/" element={<Home />} />
//           <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
//           <Route path="/signup" element={!user ? <Signup /> : <Navigate to="/dashboard" />} />
//           <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
//           <Route path="/contest/:roomId/lobby" element={<PrivateRoute><ContestLobby /></PrivateRoute>} />
//           <Route path="/contest/:roomId" element={<PrivateRoute><ContestRoom /></PrivateRoute>} />
//         </Routes>
//       </main>
//     </div>
//   );
// }
// import { Routes, Route, Navigate } from 'react-router-dom';
// import Header from './components/Header';
// import Home from './pages/Home';
// import Login from './pages/Login';
// import Signup from './pages/Signup';
// import Dashboard from './pages/Dashboard';
// import ContestLobby from './pages/ContestLobby';
// import ContestRoom from './pages/ContestRoom';
// import Library from './pages/Library';
// import useAuth from './hooks/useAuth';
// import { Toaster } from 'react-hot-toast';

// function App() {
//   const { user, loading } = useAuth();

//   // This loading check is crucial. It prevents the router from rendering
//   // anything until the authentication status has been confirmed.
//   // This is what stops the premature redirect on page reload.
//   if (loading) {
//     return (
//         <div className="min-h-screen bg-gray-900 flex items-center justify-center">
//             <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-teal-400"></div>
//         </div>
//     );
//   }

//   return (
//     <>
//       <Toaster position="top-center" reverseOrder={false} />
//       <div className="min-h-screen bg-gray-900">
//         <Header />
//         <main className="container mx-auto px-4 py-8">
//           <Routes>
//             {/* If a user is logged in, all public paths will redirect to the home page.
//               If they are logged out, they will see the public pages (Login, Signup).
//             */}
//             <Route 
//               path="/login" 
//               element={!user ? <Login /> : <Navigate to="/home" replace />} 
//             />
//             <Route 
//               path="/signup" 
//               element={!user ? <Signup /> : <Navigate to="/home" replace />} 
//             />

//             {/* Private routes are protected. If a user is not logged in,
//               they will be redirected to the login page.
//             */}
//             <Route 
//               path="/home" 
//               element={user ? <Home /> : <Navigate to="/login" replace />} 
//             />
//             <Route 
//               path="/library" 
//               element={user ? <Library /> : <Navigate to="/login" replace />} 
//             />
//             <Route 
//               path="/dashboard" 
//               element={user ? <Dashboard /> : <Navigate to="/login" replace />} 
//             />
//             <Route 
//               path="/contest/:roomId/lobby" 
//               element={user ? <ContestLobby /> : <Navigate to="/login" replace />} 
//             />
//             <Route 
//               path="/contest/:roomId" 
//               element={user ? <ContestRoom /> : <Navigate to="/login" replace />} 
//             />

//             {/* The root path ("/") now intelligently redirects.
//               - Logged-in users are sent to their home page.
//               - Logged-out users are sent to the login page.
//               This prevents showing the login page at the root path for logged-in users.
//             */}
//             <Route 
//               path="/" 
//               element={user ? <Navigate to="/home" replace /> : <Navigate to="/login" replace />} 
//             />
            
//           </Routes>
//         </main>
//       </div>
//     </>
//   );
// }

// export default App;

import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import ContestLobby from './pages/ContestLobby';
import ContestRoom from './pages/ContestRoom';
import Library from './pages/Library';
import Profile from './pages/Profile'; // Import new Profile page
import useAuth from './hooks/useAuth';
import { Toaster } from 'react-hot-toast';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-teal-400"></div>
        </div>
    );
  }

  return (
    <>
      <Toaster position="top-center" reverseOrder={false} />
      <div className="min-h-screen bg-gray-900">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route 
              path="/login" 
              element={!user ? <Login /> : <Navigate to="/home" replace />} 
            />
            <Route 
              path="/signup" 
              element={!user ? <Signup /> : <Navigate to="/home" replace />} 
            />

            <Route 
              path="/home" 
              element={user ? <Home /> : <Navigate to="/login" replace />} 
            />
            <Route 
              path="/library" 
              element={user ? <Library /> : <Navigate to="/login" replace />} 
            />
            <Route 
              path="/dashboard" 
              element={user ? <Dashboard /> : <Navigate to="/login" replace />} 
            />
            <Route 
              path="/profile" // Add new profile route
              element={user ? <Profile /> : <Navigate to="/login" replace />}
            />
            <Route 
              path="/contest/:roomId/lobby" 
              element={user ? <ContestLobby /> : <Navigate to="/login" replace />} 
            />
            <Route 
              path="/contest/:roomId" 
              element={user ? <ContestRoom /> : <Navigate to="/login" replace />} 
            />

            <Route 
              path="/" 
              element={user ? <Navigate to="/home" replace /> : <Navigate to="/login" replace />} 
            />
            
          </Routes>
        </main>
      </div>
    </>
  );
}

export default App;