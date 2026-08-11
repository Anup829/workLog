-- ============ utility ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ core org ============
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  level int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, key)
);

CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission_id)
);

CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  head_employee_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.designations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  employee_code text,
  email text,
  phone text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  designation_id uuid REFERENCES public.designations(id) ON DELETE SET NULL,
  role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL,
  tl_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  pm_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  reporting_manager_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  joining_date date,
  employment_status text NOT NULL DEFAULT 'active',
  expected_daily_minutes int,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, employee_code)
);

ALTER TABLE public.departments
  ADD CONSTRAINT departments_head_fk FOREIGN KEY (head_employee_id)
  REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  tl_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, employee_id)
);

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  client text,
  description text,
  start_date date,
  end_date date,
  pm_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  tl_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'active',
  estimated_hours numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  allocation_percent int,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, employee_id)
);

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  assignee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'todo',
  due_date date,
  estimated_hours numeric(10,2),
  actual_hours numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.work_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  date date NOT NULL,
  description text NOT NULL,
  start_time time,
  end_time time,
  duration_minutes int NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 1440),
  status text NOT NULL DEFAULT 'draft',
  approval_status text NOT NULL DEFAULT 'pending',
  remarks text,
  attachment_path text,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  is_locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_logs_status_check CHECK (status IN ('draft','submitted','under_review','approved','rejected','correction_required')),
  CONSTRAINT work_logs_approval_check CHECK (approval_status IN ('pending','approved','rejected','correction_required'))
);
CREATE INDEX work_logs_employee_date_idx ON public.work_logs (employee_id, date);
CREATE INDEX work_logs_project_idx ON public.work_logs (project_id);

CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_log_id uuid REFERENCES public.work_logs(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  duration_minutes int,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  work_log_id uuid NOT NULL REFERENCES public.work_logs(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  action text NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  type text NOT NULL DEFAULT 'info',
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, date)
);

CREATE TABLE public.leaves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  leave_type text NOT NULL DEFAULT 'casual',
  status text NOT NULL DEFAULT 'pending',
  reason text,
  approved_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, key)
);

-- updated_at triggers
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['organizations','roles','departments','designations','employees','teams','projects','tasks','work_logs','time_entries','comments','leaves','settings']
  LOOP
    EXECUTE format('CREATE TRIGGER set_%1$s_updated_at BEFORE UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;

-- ============ security helpers ============
CREATE OR REPLACE FUNCTION public.my_employee_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.my_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.employees WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.am_i_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.employees WHERE user_id = auth.uid() AND employment_status = 'active');
$$;

CREATE OR REPLACE FUNCTION public.has_perm(_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.role_permissions rp ON rp.role_id = e.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE e.user_id = auth.uid() AND p.key = _key
  );
$$;

CREATE OR REPLACE FUNCTION public.is_my_team_member(_employee_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = _employee_id AND e.tl_id = public.my_employee_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_my_project(_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id
      AND (p.pm_id = public.my_employee_id() OR p.tl_id = public.my_employee_id())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = _project_id AND pm.employee_id = public.my_employee_id()
  );
$$;

-- ============ work log guards ============
CREATE OR REPLACE FUNCTION public.work_logs_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE overlap_count int;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.is_locked AND NOT public.has_perm('worklog.lock') THEN
    RAISE EXCEPTION 'This work log is approved and locked.';
  END IF;

  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    IF NEW.end_time <= NEW.start_time THEN
      RAISE EXCEPTION 'End time must be after start time.';
    END IF;
    SELECT count(*) INTO overlap_count
    FROM public.work_logs w
    WHERE w.employee_id = NEW.employee_id
      AND w.date = NEW.date
      AND w.id <> NEW.id
      AND w.start_time IS NOT NULL AND w.end_time IS NOT NULL
      AND (NEW.start_time, NEW.end_time) OVERLAPS (w.start_time, w.end_time);
    IF overlap_count > 0 THEN
      RAISE EXCEPTION 'Overlapping time entry for this employee on this date.';
    END IF;
  END IF;

  IF NEW.approval_status = 'approved' THEN
    NEW.is_locked := true;
    NEW.status := 'approved';
    IF NEW.approved_at IS NULL THEN NEW.approved_at := now(); END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.is_locked AND public.has_perm('worklog.lock') THEN
    INSERT INTO public.audit_logs (organization_id, actor_id, action, table_name, record_id, old_value, new_value, reason)
    VALUES (NEW.organization_id, public.my_employee_id(), 'update_locked_worklog', 'work_logs', NEW.id,
            to_jsonb(OLD), to_jsonb(NEW), NEW.remarks);
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER work_logs_guard_trg
  BEFORE INSERT OR UPDATE ON public.work_logs
  FOR EACH ROW EXECUTE FUNCTION public.work_logs_guard();

CREATE OR REPLACE FUNCTION public.block_locked_worklog_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.is_locked AND NOT public.has_perm('worklog.lock') THEN
    RAISE EXCEPTION 'Approved work logs cannot be deleted.';
  END IF;
  INSERT INTO public.audit_logs (organization_id, actor_id, action, table_name, record_id, old_value, reason)
  VALUES (OLD.organization_id, public.my_employee_id(), 'delete_worklog', 'work_logs', OLD.id, to_jsonb(OLD), OLD.remarks);
  RETURN OLD;
END $$;

CREATE TRIGGER work_logs_delete_guard_trg
  BEFORE DELETE ON public.work_logs
  FOR EACH ROW EXECUTE FUNCTION public.block_locked_worklog_delete();

-- ============ grants ============
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations, public.roles, public.permissions,
  public.role_permissions, public.departments, public.designations, public.employees, public.teams,
  public.team_members, public.projects, public.project_members, public.tasks, public.work_logs,
  public.time_entries, public.approvals, public.comments, public.notifications, public.holidays,
  public.leaves, public.audit_logs, public.settings TO authenticated;
GRANT ALL ON public.organizations, public.roles, public.permissions, public.role_permissions,
  public.departments, public.designations, public.employees, public.teams, public.team_members,
  public.projects, public.project_members, public.tasks, public.work_logs, public.time_entries,
  public.approvals, public.comments, public.notifications, public.holidays, public.leaves,
  public.audit_logs, public.settings TO service_role;

-- ============ RLS ============
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org read" ON public.organizations FOR SELECT TO authenticated USING (id = public.my_org_id());
CREATE POLICY "org manage" ON public.organizations FOR UPDATE TO authenticated USING (id = public.my_org_id() AND public.has_perm('settings.manage')) WITH CHECK (id = public.my_org_id());

CREATE POLICY "roles read" ON public.roles FOR SELECT TO authenticated USING (organization_id = public.my_org_id() OR organization_id IS NULL);
CREATE POLICY "roles manage" ON public.roles FOR ALL TO authenticated USING (public.has_perm('settings.manage') AND organization_id = public.my_org_id()) WITH CHECK (public.has_perm('settings.manage') AND organization_id = public.my_org_id());

CREATE POLICY "permissions read" ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_permissions read" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_permissions manage" ON public.role_permissions FOR ALL TO authenticated USING (public.has_perm('settings.manage')) WITH CHECK (public.has_perm('settings.manage'));

CREATE POLICY "departments read" ON public.departments FOR SELECT TO authenticated USING (organization_id = public.my_org_id());
CREATE POLICY "departments manage" ON public.departments FOR ALL TO authenticated USING (organization_id = public.my_org_id() AND public.has_perm('settings.manage')) WITH CHECK (organization_id = public.my_org_id() AND public.has_perm('settings.manage'));

CREATE POLICY "designations read" ON public.designations FOR SELECT TO authenticated USING (organization_id = public.my_org_id());
CREATE POLICY "designations manage" ON public.designations FOR ALL TO authenticated USING (organization_id = public.my_org_id() AND public.has_perm('settings.manage')) WITH CHECK (organization_id = public.my_org_id() AND public.has_perm('settings.manage'));

CREATE POLICY "employees read self" ON public.employees FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "employees read team" ON public.employees FOR SELECT TO authenticated
  USING (public.has_perm('worklog.view_team') AND tl_id = public.my_employee_id());
CREATE POLICY "employees read project" ON public.employees FOR SELECT TO authenticated
  USING (public.has_perm('worklog.view_project') AND (
    pm_id = public.my_employee_id()
    OR EXISTS (SELECT 1 FROM public.project_members pm JOIN public.projects p ON p.id = pm.project_id
               WHERE pm.employee_id = public.employees.id AND p.pm_id = public.my_employee_id())));
CREATE POLICY "employees read all" ON public.employees FOR SELECT TO authenticated
  USING (public.has_perm('worklog.view_all') AND organization_id = public.my_org_id());
CREATE POLICY "employees create" ON public.employees FOR INSERT TO authenticated
  WITH CHECK (public.has_perm('employee.create') AND organization_id = public.my_org_id());
CREATE POLICY "employees edit" ON public.employees FOR UPDATE TO authenticated
  USING (public.has_perm('employee.edit') AND organization_id = public.my_org_id())
  WITH CHECK (organization_id = public.my_org_id());

CREATE POLICY "teams read" ON public.teams FOR SELECT TO authenticated USING (organization_id = public.my_org_id());
CREATE POLICY "teams manage" ON public.teams FOR ALL TO authenticated USING (organization_id = public.my_org_id() AND public.has_perm('settings.manage')) WITH CHECK (organization_id = public.my_org_id() AND public.has_perm('settings.manage'));

CREATE POLICY "team_members read" ON public.team_members FOR SELECT TO authenticated
  USING (employee_id = public.my_employee_id() OR public.is_my_team_member(employee_id) OR public.has_perm('worklog.view_all'));
CREATE POLICY "team_members manage" ON public.team_members FOR ALL TO authenticated USING (public.has_perm('settings.manage')) WITH CHECK (public.has_perm('settings.manage'));

CREATE POLICY "projects read member" ON public.projects FOR SELECT TO authenticated
  USING (organization_id = public.my_org_id() AND (
    pm_id = public.my_employee_id() OR tl_id = public.my_employee_id()
    OR public.is_project_member(id) OR public.has_perm('worklog.view_all')));
CREATE POLICY "projects create" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (public.has_perm('project.create') AND organization_id = public.my_org_id());
CREATE POLICY "projects edit" ON public.projects FOR UPDATE TO authenticated
  USING (public.has_perm('project.edit') AND organization_id = public.my_org_id()
         AND (public.has_perm('worklog.view_all') OR pm_id = public.my_employee_id()))
  WITH CHECK (organization_id = public.my_org_id());

CREATE POLICY "project_members read" ON public.project_members FOR SELECT TO authenticated
  USING (employee_id = public.my_employee_id() OR public.is_my_project(project_id) OR public.has_perm('worklog.view_all'));
CREATE POLICY "project_members manage" ON public.project_members FOR ALL TO authenticated
  USING (public.has_perm('project.edit') AND (public.is_my_project(project_id) OR public.has_perm('worklog.view_all')))
  WITH CHECK (public.has_perm('project.edit'));

CREATE POLICY "tasks read" ON public.tasks FOR SELECT TO authenticated
  USING (organization_id = public.my_org_id() AND (
    assignee_id = public.my_employee_id()
    OR public.is_project_member(project_id)
    OR public.is_my_project(project_id)
    OR (public.has_perm('worklog.view_team') AND public.is_my_team_member(assignee_id))
    OR public.has_perm('worklog.view_all')));
CREATE POLICY "tasks create" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.has_perm('task.create') AND organization_id = public.my_org_id()
              AND (public.is_my_project(project_id) OR public.has_perm('worklog.view_all')));
CREATE POLICY "tasks update" ON public.tasks FOR UPDATE TO authenticated
  USING (organization_id = public.my_org_id() AND (
    assignee_id = public.my_employee_id() OR public.is_my_project(project_id) OR public.has_perm('worklog.view_all')))
  WITH CHECK (organization_id = public.my_org_id());

CREATE POLICY "worklogs read own" ON public.work_logs FOR SELECT TO authenticated
  USING (employee_id = public.my_employee_id());
CREATE POLICY "worklogs read team" ON public.work_logs FOR SELECT TO authenticated
  USING (public.has_perm('worklog.view_team') AND public.is_my_team_member(employee_id));
CREATE POLICY "worklogs read project" ON public.work_logs FOR SELECT TO authenticated
  USING (public.has_perm('worklog.view_project') AND public.is_my_project(project_id));
CREATE POLICY "worklogs read all" ON public.work_logs FOR SELECT TO authenticated
  USING (public.has_perm('worklog.view_all') AND organization_id = public.my_org_id());
CREATE POLICY "worklogs insert own" ON public.work_logs FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.my_employee_id() AND public.am_i_active()
              AND organization_id = public.my_org_id()
              AND public.has_perm('worklog.create')
              AND status IN ('draft','submitted'));
CREATE POLICY "worklogs update own" ON public.work_logs FOR UPDATE TO authenticated
  USING (employee_id = public.my_employee_id() AND public.am_i_active() AND is_locked = false
         AND status IN ('draft','rejected','correction_required','submitted'))
  WITH CHECK (employee_id = public.my_employee_id());
CREATE POLICY "worklogs review team" ON public.work_logs FOR UPDATE TO authenticated
  USING (public.has_perm('worklog.approve') AND (public.is_my_team_member(employee_id) OR public.is_my_project(project_id)))
  WITH CHECK (organization_id = public.my_org_id());
CREATE POLICY "worklogs admin all" ON public.work_logs FOR ALL TO authenticated
  USING (public.has_perm('worklog.lock') AND organization_id = public.my_org_id())
  WITH CHECK (organization_id = public.my_org_id());
CREATE POLICY "worklogs delete own draft" ON public.work_logs FOR DELETE TO authenticated
  USING (employee_id = public.my_employee_id() AND is_locked = false AND status = 'draft');

CREATE POLICY "time_entries own" ON public.time_entries FOR ALL TO authenticated
  USING (employee_id = public.my_employee_id())
  WITH CHECK (employee_id = public.my_employee_id() AND organization_id = public.my_org_id());
CREATE POLICY "time_entries oversight" ON public.time_entries FOR SELECT TO authenticated
  USING (public.has_perm('worklog.view_all') OR (public.has_perm('worklog.view_team') AND public.is_my_team_member(employee_id)));

CREATE POLICY "approvals read" ON public.approvals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.work_logs w WHERE w.id = work_log_id));
CREATE POLICY "approvals insert" ON public.approvals FOR INSERT TO authenticated
  WITH CHECK (public.has_perm('worklog.approve') AND organization_id = public.my_org_id()
              AND reviewer_id = public.my_employee_id());

CREATE POLICY "comments read" ON public.comments FOR SELECT TO authenticated USING (organization_id = public.my_org_id());
CREATE POLICY "comments write" ON public.comments FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.my_org_id() AND author_id = public.my_employee_id());
CREATE POLICY "comments edit own" ON public.comments FOR UPDATE TO authenticated
  USING (author_id = public.my_employee_id()) WITH CHECK (author_id = public.my_employee_id());
CREATE POLICY "comments delete own" ON public.comments FOR DELETE TO authenticated
  USING (author_id = public.my_employee_id() OR public.has_perm('settings.manage'));

CREATE POLICY "notifications own" ON public.notifications FOR SELECT TO authenticated
  USING (employee_id = public.my_employee_id());
CREATE POLICY "notifications mark read" ON public.notifications FOR UPDATE TO authenticated
  USING (employee_id = public.my_employee_id()) WITH CHECK (employee_id = public.my_employee_id());
CREATE POLICY "notifications create" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.my_org_id());

CREATE POLICY "holidays read" ON public.holidays FOR SELECT TO authenticated USING (organization_id = public.my_org_id());
CREATE POLICY "holidays manage" ON public.holidays FOR ALL TO authenticated
  USING (public.has_perm('settings.manage') AND organization_id = public.my_org_id())
  WITH CHECK (public.has_perm('settings.manage') AND organization_id = public.my_org_id());

CREATE POLICY "leaves read own" ON public.leaves FOR SELECT TO authenticated USING (employee_id = public.my_employee_id());
CREATE POLICY "leaves read oversight" ON public.leaves FOR SELECT TO authenticated
  USING (public.has_perm('worklog.view_all') OR (public.has_perm('worklog.view_team') AND public.is_my_team_member(employee_id)));
CREATE POLICY "leaves create own" ON public.leaves FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.my_employee_id() AND organization_id = public.my_org_id());
CREATE POLICY "leaves manage" ON public.leaves FOR UPDATE TO authenticated
  USING (public.has_perm('worklog.approve') OR public.has_perm('worklog.view_all'))
  WITH CHECK (organization_id = public.my_org_id());

CREATE POLICY "settings read" ON public.settings FOR SELECT TO authenticated USING (organization_id = public.my_org_id());
CREATE POLICY "settings manage" ON public.settings FOR ALL TO authenticated
  USING (public.has_perm('settings.manage') AND organization_id = public.my_org_id())
  WITH CHECK (public.has_perm('settings.manage') AND organization_id = public.my_org_id());

CREATE POLICY "audit read" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_perm('settings.manage') AND organization_id = public.my_org_id());
CREATE POLICY "audit insert" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.my_org_id());

-- ============ seed ============
INSERT INTO public.organizations (name, slug) VALUES ('My Company', 'my-company');

INSERT INTO public.roles (organization_id, key, name, level)
SELECT o.id, r.key, r.name, r.level FROM public.organizations o,
(VALUES ('employee','Employee',10),('tl','Team Lead',20),('pm','Project Manager',30),('hr_admin','HR / Admin',40)) AS r(key,name,level)
WHERE o.slug = 'my-company';

INSERT INTO public.permissions (key, description) VALUES
 ('worklog.create','Create own work logs'),
 ('worklog.view_own','View own work logs'),
 ('worklog.view_team','View direct team work logs'),
 ('worklog.view_project','View project work logs'),
 ('worklog.view_all','View all work logs'),
 ('worklog.edit_own','Edit own work logs'),
 ('worklog.approve','Approve or reject work logs'),
 ('worklog.lock','Lock, unlock or override approved logs'),
 ('employee.create','Create employees'),
 ('employee.edit','Edit employees'),
 ('employee.deactivate','Deactivate employees'),
 ('project.create','Create projects'),
 ('project.edit','Edit projects'),
 ('task.create','Create tasks'),
 ('task.assign','Assign tasks'),
 ('report.view_team','View team reports'),
 ('report.view_project','View project reports'),
 ('report.view_all','View all reports'),
 ('settings.manage','Manage organization settings');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p ON true
WHERE (r.key = 'employee' AND p.key IN ('worklog.create','worklog.view_own','worklog.edit_own'))
   OR (r.key = 'tl' AND p.key IN ('worklog.create','worklog.view_own','worklog.edit_own','worklog.view_team','worklog.approve','report.view_team','task.create','task.assign'))
   OR (r.key = 'pm' AND p.key IN ('worklog.create','worklog.view_own','worklog.edit_own','worklog.view_project','worklog.view_team','worklog.approve','project.create','project.edit','task.create','task.assign','report.view_project','report.view_team'))
   OR (r.key = 'hr_admin');

INSERT INTO public.settings (organization_id, key, value)
SELECT o.id, s.key, s.value FROM public.organizations o,
(VALUES ('expected_daily_minutes','480'::jsonb),
        ('week_off_days','[0,6]'::jsonb),
        ('reminder_times','["18:00","19:00","20:00"]'::jsonb))
AS s(key,value)
WHERE o.slug = 'my-company';