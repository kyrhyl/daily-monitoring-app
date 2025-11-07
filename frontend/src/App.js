import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

// CSS
import './index.css';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="App">
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              
              {/* Protected routes */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              } />

              {/* Admin only routes */}
              <Route path="/users" element={
                <ProtectedRoute requiredRole="admin">
                  <Layout>
                    <div className="p-6">
                      <h1 className="text-2xl font-bold">Users Management</h1>
                      <p className="text-gray-600">Coming soon...</p>
                    </div>
                  </Layout>
                </ProtectedRoute>
              } />

              {/* Team management routes */}
              <Route path="/teams" element={
                <ProtectedRoute>
                  <Layout>
                    <div className="p-6">
                      <h1 className="text-2xl font-bold">Teams</h1>
                      <p className="text-gray-600">Coming soon...</p>
                    </div>
                  </Layout>
                </ProtectedRoute>
              } />

              {/* Project management routes */}
              <Route path="/projects" element={
                <ProtectedRoute allowedRoles={['admin', 'team_leader']}>
                  <Layout>
                    <div className="p-6">
                      <h1 className="text-2xl font-bold">Projects</h1>
                      <p className="text-gray-600">Coming soon...</p>
                    </div>
                  </Layout>
                </ProtectedRoute>
              } />

              {/* Task management routes */}
              <Route path="/tasks" element={
                <ProtectedRoute>
                  <Layout>
                    <div className="p-6">
                      <h1 className="text-2xl font-bold">Tasks</h1>
                      <p className="text-gray-600">Coming soon...</p>
                    </div>
                  </Layout>
                </ProtectedRoute>
              } />

              {/* Profile and settings */}
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Layout>
                    <div className="p-6">
                      <h1 className="text-2xl font-bold">Profile</h1>
                      <p className="text-gray-600">Coming soon...</p>
                    </div>
                  </Layout>
                </ProtectedRoute>
              } />

              <Route path="/settings" element={
                <ProtectedRoute>
                  <Layout>
                    <div className="p-6">
                      <h1 className="text-2xl font-bold">Settings</h1>
                      <p className="text-gray-600">Coming soon...</p>
                    </div>
                  </Layout>
                </ProtectedRoute>
              } />

              {/* Unauthorized page */}
              <Route path="/unauthorized" element={
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">403</h1>
                    <h2 className="text-xl font-semibold text-gray-700 mb-2">Access Denied</h2>
                    <p className="text-gray-600 mb-4">
                      You don't have permission to access this resource.
                    </p>
                    <button
                      onClick={() => window.history.back()}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                    >
                      Go Back
                    </button>
                  </div>
                </div>
              } />

              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              
              {/* 404 page */}
              <Route path="*" element={
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                    <h2 className="text-xl font-semibold text-gray-700 mb-2">Page Not Found</h2>
                    <p className="text-gray-600 mb-4">
                      The page you're looking for doesn't exist.
                    </p>
                    <button
                      onClick={() => window.history.back()}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                    >
                      Go Back
                    </button>
                  </div>
                </div>
              } />
            </Routes>

            {/* Toast notifications */}
            <ToastContainer
              position="top-right"
              autoClose={5000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
            />
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;