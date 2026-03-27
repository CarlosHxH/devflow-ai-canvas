import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  FolderKanban,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface ProjectSummary {
  id: string;
  name: string;
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
}

export default function Reports() {
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [summaries, setSummaries] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentWorkspace) return;
    const load = async () => {
      setLoading(true);
      const { data: projects } = await supabase
        .from("projects")
        .select("id, name")
        .eq("workspace_id", currentWorkspace.id);

      if (!projects || projects.length === 0) {
        setSummaries([]);
        setLoading(false);
        return;
      }

      const projectIds = projects.map((p) => p.id);
      const [tasksRes, statusesRes] = await Promise.all([
        supabase.from("tasks").select("id, project_id, status_id, due_date").in("project_id", projectIds),
        supabase.from("project_statuses").select("id, project_id, name").in("project_id", projectIds),
      ]);

      const tasks = tasksRes.data || [];
      const statuses = statusesRes.data || [];
      const now = new Date();

      const result: ProjectSummary[] = projects.map((p) => {
        const projectTasks = tasks.filter((t) => t.project_id === p.id);
        const doneStatusIds = statuses
          .filter((s) => s.project_id === p.id && (s.name.toLowerCase().includes("concluído") || s.name.toLowerCase().includes("done")))
          .map((s) => s.id);

        const doneTasks = projectTasks.filter((t) => doneStatusIds.includes(t.status_id)).length;
        const overdueTasks = projectTasks.filter(
          (t) => t.due_date && new Date(t.due_date) < now && !doneStatusIds.includes(t.status_id)
        ).length;

        return { id: p.id, name: p.name, totalTasks: projectTasks.length, doneTasks, overdueTasks };
      });

      setSummaries(result);
      setLoading(false);
    };
    load();
  }, [currentWorkspace]);

  const totalAll = summaries.reduce((s, p) => s + p.totalTasks, 0);
  const doneAll = summaries.reduce((s, p) => s + p.doneTasks, 0);
  const overdueAll = summaries.reduce((s, p) => s + p.overdueTasks, 0);

  const chartData = useMemo(
    () =>
      summaries
        .filter((s) => s.totalTasks > 0)
        .map((s) => ({
          name: s.name.length > 15 ? s.name.slice(0, 15) + "…" : s.name,
          concluidas: s.doneTasks,
          pendentes: s.totalTasks - s.doneTasks,
        })),
    [summaries]
  );

  return (
    <AppLayout title="Relatórios">
      <div className="space-y-6 animate-fade-in">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Relatórios</h2>
          <p className="text-muted-foreground">Visão geral de todos os projetos</p>
        </div>

        {!currentWorkspace ? (
          <p className="text-muted-foreground">Selecione um workspace</p>
        ) : loading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse"><CardHeader><div className="h-4 bg-muted rounded w-1/2" /></CardHeader></Card>
            ))}
          </div>
        ) : (
          <>
            {/* Overview */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total de Tarefas</CardTitle>
                  <FolderKanban className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalAll}</div>
                  <p className="text-xs text-muted-foreground mt-1">em {summaries.length} projetos</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Concluídas</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-500">{doneAll}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {totalAll > 0 ? Math.round((doneAll / totalAll) * 100) : 0}% do total
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Atrasadas</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-500">{overdueAll}</div>
                  <p className="text-xs text-muted-foreground mt-1">tarefas com prazo vencido</p>
                </CardContent>
              </Card>
            </div>

            {/* Chart */}
            {chartData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Progresso por Projeto</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartData}>
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
                      <Bar dataKey="concluidas" name="Concluídas" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} stackId="a" />
                      <Bar dataKey="pendentes" name="Pendentes" fill="hsl(var(--muted-foreground) / 0.3)" radius={[4, 4, 0, 0]} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Project list */}
            <div className="space-y-3">
              {summaries.map((proj) => {
                const pct = proj.totalTasks > 0 ? Math.round((proj.doneTasks / proj.totalTasks) * 100) : 0;
                return (
                  <Card
                    key={proj.id}
                    className="cursor-pointer hover:border-primary/30 transition-colors"
                    onClick={() => navigate(`/projects/${proj.id}/dashboard`)}
                  >
                    <CardContent className="flex items-center gap-4 py-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm truncate">{proj.name}</span>
                          {proj.overdueTasks > 0 && (
                            <Badge variant="destructive" className="text-xs">{proj.overdueTasks} atrasadas</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <Progress value={pct} className="flex-1 h-1.5" />
                          <span className="text-xs text-muted-foreground w-16 text-right">
                            {proj.doneTasks}/{proj.totalTasks} ({pct}%)
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
