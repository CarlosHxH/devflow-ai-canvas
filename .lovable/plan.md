
# DevFlow OS - Plataforma Integrada de Engenharia com IA

## Phase 1: Foundation & Auth
- **Authentication**: Email/password signup & login with Supabase Auth
- **User profiles table** with avatar, display name
- **Workspace system**: Create/switch workspaces
- **User roles table** (owner, admin, member) with RLS security definer functions
- **Invite members** to workspaces via email
- **App layout**: Sidebar navigation (Projects, Canvas, Docs, Dashboard) with collapsible sidebar

## Phase 2: Project & Task Management (Kanban)
- **Projects CRUD**: Create projects within a workspace, assign members
- **Custom statuses** per project (Backlog, Refinement, Dev, QA, Done) stored in DB
- **Kanban board** with drag-and-drop columns (using dnd-kit or similar)
- **Task cards** with: title, description, priority (low/medium/high/critical), assignee, due date
- **Card details modal**: Checklists (sub-items with checkboxes), comments thread, file attachments (Supabase Storage)
- **Filters**: By assignee, priority, status
- **RLS policies**: Users only see projects/tasks in their workspace

## Phase 3: Canvas & AI Diagrams
- **Infinite canvas** using React Flow for node-based editing
- **Mermaid.js rendering**: Parse and display Mermaid diagrams on canvas
- **AI diagram generation**: Text prompt → Edge function calls Lovable AI → Returns Mermaid code → Rendered on canvas
- **Dual mode**: Users can type Mermaid code manually OR use AI to generate
- **Export**: PNG/SVG/Markdown export of diagrams
- **Canvas per project**: Each project has its own canvas space

## Phase 4: Documentation Wiki
- **Markdown editor** with live preview (using a rich text / markdown library)
- **Wiki pages** organized per project with hierarchy (parent/child pages)
- **AI assistant**: Chat panel that reads project docs context and answers technical questions or generates new documentation sections via Lovable AI
- **Search** across all wiki pages within a project

## Phase 5: Dashboard & Progress
- **Project dashboard**: Progress bar per project based on task completion (done tasks / total tasks)
- **Checklist completion** factored into progress calculation
- **Overview cards**: Tasks by status, tasks by assignee, overdue tasks
- **Charts** (using Recharts): Burndown-style progress over time, task distribution by priority/status

## Database Schema (Supabase)
- `workspaces` (id, name, created_by, created_at)
- `workspace_members` (id, workspace_id, user_id, invited_email, status)
- `user_roles` (id, user_id, role enum: owner/admin/member) — separate table per security requirements
- `profiles` (id, full_name, avatar_url)
- `projects` (id, workspace_id, name, description, created_by)
- `project_members` (id, project_id, user_id)
- `project_statuses` (id, project_id, name, position, color)
- `tasks` (id, project_id, status_id, title, description, priority, assignee_id, due_date, position)
- `checklists` (id, task_id, title, completed)
- `comments` (id, task_id, user_id, content, created_at)
- `attachments` (id, task_id, file_url, file_name, uploaded_by)
- `canvases` (id, project_id, name, mermaid_code, react_flow_data jsonb)
- `wiki_pages` (id, project_id, parent_id, title, content_markdown, created_by, updated_at)

All tables protected with RLS policies scoped to workspace membership.

## Key Pages
- `/login`, `/signup` — Auth
- `/` — Workspace selector / dashboard overview
- `/projects` — Project list
- `/projects/:id/board` — Kanban board
- `/projects/:id/canvas` — AI Canvas & diagrams
- `/projects/:id/docs` — Wiki pages
- `/projects/:id/dashboard` — Progress & charts
- `/settings` — Workspace settings, members, roles
