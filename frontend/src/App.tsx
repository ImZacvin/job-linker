import { BrowserRouter, Navigate, Route, Routes } from "react-router"

import ProtectedRoute from "@/components/ProtectedRoute"
import { AuthProvider } from "@/context/AuthContext"
import Dashboard from "@/pages/Dashboard"
import Login from "@/pages/Login"
import Register from "@/pages/Register"

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
