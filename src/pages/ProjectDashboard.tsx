import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ListTodo,
  Users,
  TrendingUp,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from "recharts";

interface Task {
  id: string;
  title: string;
  priority: string;
  status_id: string;
  assignee_id: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

interface Status {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface Checklist {
  id: string;
  task_id: string;
  completed: boolean;
}

interface Profile {
  id: string;
  full_name: string | null;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "hsl(0 72% 51%)",
  high: "hsl(25 95% 53%)",
  medium: "hsl(45 93% 47%)",
  low: "hsl(142 71% 45%)",
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

export default function ProjectDashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    const load = async () => {
      setLoading(true);
      const [projRes, taskRes, statusRes, checkRes, profileRes] = await Promise.all([
        supabase.from("projects").select("name").eq("id", projectId).single(),
        supabase.from("tasks").select("*").eq("project_id", projectId),
        supabase.from("project_statuses").select("*").eq("project_id", projectId).order("position"),
        supabase.from("checklists").select("id, task_id, completed"),
        supabase.from("profiles").select("id, full_name"),
      ]);
      if (projRes.data) setProjectName(projRes.data.name);
      setTasks((taskRes.data as Task[]) || []);
      setStatuses((statusRes.data as Status[]) || []);
      setChecklists((checkRes.data as Checklist[]) || []);
      setProfiles((profileRes.data as Profile[]) || []);
      setLoading(false);
    };
    load();
  }, [projectId]);

  const doneStatus = statuses.find(
    (s) => s.name.toLowerCase().includes("concluído") || s.name.toLowerCase().includes("done")
  );

  const totalTasks = tasks.length;
  const doneTasks = doneStatus ? tasks.filter((t) => t.status_id === doneStatus.id).length : 0;
  const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const overdueTasks = tasks.filter(
    (t) => t.due_date && new Date(t.due_date) < new Date() && t.status_id !== doneStatus?.id
  ).length;

  const totalChecklist = checklists.length;
  const completedChecklist = checklists.filter((c) => c.completed).length;
  const checklistPercent = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0;

  // Status distribution for pie chart
  const statusData = useMemo(() => {
    return statuses.map((s) => ({
      name: s.name,
      value: tasks.filter((t) => t.status_id === s.id).length,
      color: s.color,
    })).filter((d) => d.value > 0);
  }, [tasks, statuses]);

  // Priority distribution for bar chart
  const priorityData = useMemo(() => {
    const priorities = ["critical", "high", "medium", "low"];
    return priorities.map((p) => ({
      name: PRIORITY_LABELS[p],
      count: tasks.filter((t) => t.priority === p).length,
      fill: PRIORITY_COLORS[p],
    })).filter((d) => d.count > 0);
  }, [tasks]);

  // Tasks by assignee
  const assigneeData = useMemo(() => {
    const map = new Map<string, number>();
    tasks.forEach((t) => {
      const key = t.assignee_id || "unassigned";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).map(([id, count]) => {
      const profile = profiles.find((p) => p.id === id);
      return {
        name: id === "unassigned" ? "Sem responsável" : profile?.full_name || "Usuário",
        count,
      };
    });
  }, [tasks, profiles]);

  // Burndown-style: tasks created vs completed over time (last 14 days)
  const burndownData = useMemo(() => {
    const days = 14;
    const data = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const label = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

      const createdBefore = tasks.filter(
        (t) => t.created_at.split("T")[0] <= dateStr
      ).length;
      const completedBefore = doneStatus
        ? tasks.filter(
            (t) => t.status_id === doneStatus.id && t.updated_at.split("T")[0] <= dateStr
          ).length
        : 0;

      data.push({
        date: label,
        total: createdBefore,
        concluidas: completedBefore,
        pendentes: createdBefore - completedBefore,
      });
    }
    return data;
  }, [tasks, doneStatus]);

  if (!projectId) return null;

  return (
    <AppLayout title={`Dashboard — ${projectName}`}>
      <div className="space-y-6 animate-fade-in p-1">
        <Button variant="ghost" size="sm" onClick={() => navigate("/projects")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader><div className="h-4 bg-muted rounded w-1/2" /></CardHeader>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {/* Overview Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total de Tarefas</CardTitle>
                  <ListTodo className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalTasks}</div>
                  <Progress value={progressPercent} className="mt-2 h-1.5" />
                  <p className="text-xs text-muted-foreground mt-1">{progressPercent}% concluído</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Concluídas</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-500">{doneTasks}</div>
                  <p className="text-xs text-muted-foreground mt-1">de {totalTasks} tarefas</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Atrasadas</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-500">{overdueTasks}</div>
                  <p className="text-xs text-muted-foreground mt-1">tarefas com prazo vencido</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Checklists</CardTitle>
                  <TrendingUp className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{completedChecklist}/{totalChecklist}</div>
                  <Progress value={checklistPercent} className="mt-2 h-1.5" />
                  <p className="text-xs text-muted-foreground mt-1">{checklistPercent}% itens completos</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Burndown Area Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Evolução (14 dias)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={burndownData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: 12,
                        }}
                      />
                      <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" name="Total criadas" />
                      <Area type="monotone" dataKey="concluidas" stroke="hsl(142 71% 45%)" fill="hsl(142 71% 45% / 0.15)" name="Concluídas" />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Status Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Distribuição por Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {statusData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-12">Sem tarefas</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                          labelLine={false}
                        >
                          {statusData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Priority Bar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Tarefas por Prioridade</CardTitle>
                </CardHeader>
                <CardContent>
                  {priorityData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-12">Sem tarefas</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={priorityData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: 12,
                          }}
                        />
                        <Bar dataKey="count" name="Tarefas" radius={[4, 4, 0, 0]}>
                          {priorityData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Assignee Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Tarefas por Responsável</CardTitle>
                </CardHeader>
                <CardContent>
                  {assigneeData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-12">Sem tarefas</p>
                  ) : (
                    <div className="space-y-3 pt-2">
                      {assigneeData
                        .sort((a, b) => b.count - a.count)
                        .map((item) => (
                          <div key={item.name} className="flex items-center gap-3">
                            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Users className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium truncate">{item.name}</span>
                                <Badge variant="secondary" className="text-xs">{item.count}</Badge>
                              </div>
                              <Progress
                                value={(item.count / totalTasks) * 100}
                                className="h-1.5"
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
