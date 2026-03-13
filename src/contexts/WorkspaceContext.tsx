import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

interface Workspace {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  setCurrentWorkspace: (ws: Workspace) => void;
  loading: boolean;
  refetch: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspaces: [],
  currentWorkspace: null,
  setCurrentWorkspace: () => {},
  loading: true,
  refetch: async () => {},
});

export const useWorkspace = () => useContext(WorkspaceContext);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = async () => {
    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("workspaces")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setWorkspaces(data);
      const savedId = localStorage.getItem("devflow_workspace_id");
      const saved = data.find((w) => w.id === savedId);
      if (saved) {
        setCurrentWorkspace(saved);
      } else if (data.length > 0) {
        setCurrentWorkspace(data[0]);
        localStorage.setItem("devflow_workspace_id", data[0].id);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [user]);

  const handleSetWorkspace = (ws: Workspace) => {
    setCurrentWorkspace(ws);
    localStorage.setItem("devflow_workspace_id", ws.id);
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        setCurrentWorkspace: handleSetWorkspace,
        loading,
        refetch: fetchWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
