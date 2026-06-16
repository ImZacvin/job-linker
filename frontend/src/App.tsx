import { BrowserRouter, Navigate, Route, Routes } from "react-router"

import ProtectedRoute from "@/components/ProtectedRoute"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/context/AuthContext"
import CvUpload from "@/pages/CvUpload"
import Dashboard from "@/pages/Dashboard"
import Extension from "@/pages/Extension"
import Login from "@/pages/Login"
import Recommended from "@/pages/Recommended"
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
          <Route
            path="/cv"
            element={
              <ProtectedRoute>
                <CvUpload />
              </ProtectedRoute>
            }
          />
          <Route
            path="/recommended"
            element={
              <ProtectedRoute>
                <Recommended />
              </ProtectedRoute>
            }
          />
          <Route
            path="/extension"
            element={
              <ProtectedRoute>
                <Extension />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
