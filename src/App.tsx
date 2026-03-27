import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import CreateWorkspace from "./pages/CreateWorkspace";
import WorkspaceSettings from "./pages/WorkspaceSettings";
import Projects from "./pages/Projects";
import Canvas from "./pages/Canvas";
import Docs from "./pages/Docs";
import Reports from "./pages/Reports";
import ProjectBoard from "./pages/ProjectBoard";
import ProjectCanvas from "./pages/ProjectCanvas";
import ProjectWiki from "./pages/ProjectWiki";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-lg gradient-primary animate-pulse" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-lg gradient-primary animate-pulse" />
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <WorkspaceProvider>
            <Routes>
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/workspace/new" element={<ProtectedRoute><CreateWorkspace /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><WorkspaceSettings /></ProtectedRoute>} />
              <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
              <Route path="/projects/:projectId/board" element={<ProtectedRoute><ProjectBoard /></ProtectedRoute>} />
              <Route path="/projects/:projectId/canvas" element={<ProtectedRoute><ProjectCanvas /></ProtectedRoute>} />
              <Route path="/projects/:projectId/wiki" element={<ProtectedRoute><ProjectWiki /></ProtectedRoute>} />
              <Route path="/canvas" element={<ProtectedRoute><Canvas /></ProtectedRoute>} />
              <Route path="/docs" element={<ProtectedRoute><Docs /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </WorkspaceProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
