# Time Keeper

Lovable Prompt — Employee Work Log & Management System

Paste everything below into Lovable as your project prompt. It's structured so Lovable scaffolds the MVP first (Phase 1), with Phase 2/3 features clearly marked so you can ask for them in follow-up prompts once the core is stable.

PROMPT START

Build a full-stack Employee Work Log & Management System using React (JSX, not TSX) + Vite + Tailwind CSS + shadcn/ui on the frontend and Supabase (Auth, Postgres, Row Level Security, Realtime) as the backend. I am a frontend developer with no backend experience, so implement all backend logic (database schema, RLS policies, triggers, functions) yourself and explain any Supabase setup steps I need to run manually (e.g., SQL editor scripts, enabling extensions).

1. Product Summary

This is an internal tool where employees log daily work (project, task, time spent, description), and higher roles monitor and manage that data. Four roles, each with a different UI scope:

Employee — logs their own work only. Simplest possible UI.

Team Lead (TL) — monitors/manages their direct team's logs and approvals.

Project Manager (PM) — manages projects, tasks, and project-level reporting.

HR/Admin — manages the whole organization: employees, departments, roles, permissions, global reports, audit logs.

Core philosophy: Employees should spend minimum time managing the system and maximum time doing their actual work. Keep the Employee UI extremely lightweight; scale up complexity only for TL/PM/HR.

2. Tech Stack

React + Vite (JavaScript/JSX, no TypeScript)

React Router for routing

Tailwind CSS + shadcn/ui components

React Hook Form + Zod for form validation

Recharts for charts

Lucide React for icons

TanStack Query for data fetching/caching

date-fns for date handling

Supabase: Auth (email/password to start), Postgres, Row Level Security, Realtime (for notifications and live "who's logged today" status), Storage (for optional log attachments)

3. Roles & Permission Model

Implement a permission-based system, not hard-coded role checks, so it's scalable:

Define a permissions table and a role_permissions mapping table rather than sprinkling if (role === 'hr') checks everywhere.

Example permission keys: worklog.create, worklog.view_own, worklog.view_team, worklog.view_project, worklog.view_all, worklog.edit_own, worklog.approve, worklog.lock, employee.create, employee.edit, employee.deactivate, project.create, project.edit, task.create, task.assign, report.view_team, report.view_project, report.view_all, settings.manage.

Critical: enforce all of this at the Supabase/database level using Row Level Security policies — never rely only on hiding UI elements in React. The frontend should hide/show menu items for UX, but RLS must be the real gatekeeper.

Hierarchy: HR/Admin → PM → TL → Employee. Each TL only sees employees directly reporting to them (not other TLs' teams). Each PM only sees projects assigned to them (not full HR data). HR sees everything.

4. Database Schema (Supabase / Postgres)

Design and create these tables with proper foreign keys, organization_id on every business table (for future multi-org support), and created_at/updated_at timestamps:

organizations
users (extends Supabase auth.users via a profile table)
employees (name, employee_id, department_id, designation, tl_id, pm_id, reporting_manager_id, joining_date, employment_status, role)
departments
designations
roles
permissions
role_permissions
teams
team_members
projects (name, code, client, description, start_date, end_date, pm_id, tl_id, priority, status, estimated_hours)
project_members
tasks (name, description, project_id, assignee_id, created_by, priority, status, due_date, estimated_hours, actual_hours)
work_logs (employee_id, project_id, task_id, date, description, start_time, end_time, duration_minutes, status, approval_status, remarks, submitted_at, approved_at, approved_by)
time_entries (for timer-based tracking, linked to work_logs)
approvals (work_log_id, reviewer_id, action, comment, created_at)
comments
notifications
holidays
leaves
audit_logs (actor_id, action, table_name, record_id, old_value, new_value, reason, created_at)
settings (org-level configurable values like daily expected hours)


Key rules to encode in schema/constraints/triggers:

Store duration_minutes as an integer, never as a formatted string like "2h 30m" — format it in the UI only.

Prevent overlapping time entries for the same employee on the same day (validate in a trigger or edge function).

Approved work logs become locked — only HR/Admin can modify them, and any such modification must write an audit_logs row recording who changed what, old value, new value, and reason.

Weekends/holidays/approved leave days must NOT count as "missing log" days — compute this against holidays and leaves tables, not hard-coded weekday logic.

Expected daily hours must be configurable per employee/org via settings, never hard-coded to 8.

Inactive/deactivated employees cannot create new work logs (enforce via RLS).

5. Row Level Security — Required Policies

Employees: SELECT/INSERT/UPDATE only on their own work_logs rows, and only while status is draft or rejected. No access to other employees' data.

TL: SELECT on work_logs and employees where the employee's tl_id = the TL's own user id. No access to other TLs' teams.

PM: SELECT on work_logs, tasks, employees scoped to projects where projects.pm_id = the PM's own id. No HR-sensitive fields (e.g., salary — not modeled here, but keep this extensible).

HR/Admin: full access to all tables, but every UPDATE/DELETE on locked/approved records must go through a function that also writes to audit_logs.

Nobody except HR/Admin can delete rows from audit_logs.

6. Core Screens / Routes (React Router)

Auth

/login — Supabase email/password login.

Employee (/dashboard, simplest UI)

Dashboard: today's hours, this week's hours, tasks completed, pending tasks, today's log entries, quick actions (Add Work Log, Start Timer, View History, My Tasks).

My Work Log: add/edit entries (project, task, description, start/end time or manual duration, status, remarks, optional attachment), daily summary bar (logged vs expected vs remaining), Save Draft / Submit Day buttons.

My Tasks, My Projects (read-only, assigned items only).

Calendar view (month/week/day) showing daily hours and status colors (completed/incomplete/missing/leave/holiday).

Notifications, Profile (view-only for most fields).

Team Lead (adds on top of Employee UI)

Team dashboard: team members count, logged today, missing logs, total/average hours, per-employee status table.

Team Work Logs: filter by employee/project/date/status; drill into an employee's day to Approve or Request Correction with a comment.

Team Reports (exportable).

Project Manager

PM dashboard: active projects, active tasks, completed tasks, total logged hours, project progress table, estimated-vs-actual hours table.

Project detail view: progress %, logged vs estimated vs remaining hours, per-employee hours breakdown.

Project & Task management: create/edit projects, create/assign tasks, set priority/status/due dates/estimates.

Project-level Work Logs and Reports.

HR/Admin

HR dashboard: total/active/on-leave employees, missing logs today, today's total logged hours, department overview table.

Employee Management: table with add/edit/deactivate, assign TL/PM/department/project, change reporting manager.

Organization Management: departments, teams, designations, roles, permissions, work categories, holidays, working hours, company settings.

Global Work Log management: view/edit/correct/lock/approve/reject/reopen any log (all writes audited).

Reports: employee/department/team/project reports, missing-log report, late-submission report, hours report, productivity/utilization report — all exportable to CSV/Excel/PDF.

Audit Logs viewer (read-only, immutable).

Organization tree view (Departments → TLs → Employees).

7. Work Log Status Flow

Draft → Submitted → Under Review → Approved (locked)
                          ↓
                       Rejected → Correction Required → Employee edits → Resubmit


If no TL is configured for an employee, submissions route to PM review. HR can override the workflow at any point.

8. Notifications (use Supabase Realtime)

Employee: daily log reminder, log rejected/correction requested, task assigned, deadline approaching.

TL: employee missing log, log submitted for review, correction requested.

PM: task overdue, project hours exceeded, allocation issue.

HR: missing logs, new employee added/deactivated, approvals pending.

HR-configurable reminder schedule (e.g., 6:00 PM reminder, 7:00 PM follow-up, 8:00 PM escalation to TL) — implement via a Supabase scheduled Edge Function (cron).

9. UI/UX Guidelines

Professional admin dashboard layout: top bar (logo, search, notifications, profile) + left sidebar nav that changes by role + main content area.

Use shadcn/ui components (tables, dialogs, dropdowns, tabs, badges for status) with Tailwind for styling. Use color-coded status badges (green=Approved/Completed, yellow=Draft/Pending, red=Missing/Rejected, blue=Submitted/Under Review).

Keep the Employee dashboard minimal — no analytics overload. Save charts (Recharts) for TL/PM/HR dashboards: team hours, employee comparison, project progress, estimated vs actual, department utilization, missing logs trend.

The "Add Work Log" flow should be completable in a few seconds: Project dropdown → Task dropdown → Description → Time (manual or timer) → Status → Save.

Prevent overlapping time entries in the UI with inline validation before hitting the database constraint.

10. Build Order (please build in this order)

Phase 1 — MVP (build this first)

Supabase project setup: schema, RLS policies, auth.

Auth (login) + role-based routing/redirects.

Employee, Department, Team, Project, Task core CRUD (HR/PM only where applicable).

Daily Work Log: create, edit draft, submit, view history — Employee side only.

Basic role-appropriate dashboards (numbers/cards only, minimal charts).

Permission-based route/UI guarding tied to RLS.

Phase 2 — Management (build after Phase 1 is working) 7. TL/PM/HR dashboards with full detail. 8. Approval workflow (submit → review → approve/reject → correction). 9. Notifications (in-app, Realtime-driven). 10. Reports with CSV/Excel/PDF export. 11. Audit logs.

Phase 3 — Advanced (build last) 12. Timer-based time tracking (start/pause/stop, converts to log entry). 13. Calendar view with holiday/leave-aware missing-log logic. 14. Leave & holiday management. 15. Estimated-vs-actual analytics, resource utilization. 16. Attachments, comments, recurring tasks.

Please start by scaffolding the Supabase schema + RLS policies and the Phase 1 items, and confirm the schema with me before generating all the frontend screens.

PROMPT END

Notes for you (not part of the Lovable prompt)

Lovable prompts work best when kept focused — if the first generation feels overwhelming, you can literally paste just the "Phase 1" section first, get that working, then paste Phase 2, then Phase 3 as follow-up messages in the same Lovable project.

Since you said you can't handle backend: after Lovable connects Supabase, double-check the RLS policies it generates by asking Lovable to "list all RLS policies for the work_logs table" — this is the part most likely to have gaps, and it's the most important part for this app (employee data leakage between TLs is the main risk).

If Lovable pushes back on JSX-only (some templates default to TSX), explicitly say "no TypeScript, plain JSX" in your first message — it usually complies. if not build full then say or tell me how much complete project , or Up to what point or section

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8f20b528-b630-46fb-8a23-0f85dd96305b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
