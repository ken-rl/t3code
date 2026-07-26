import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import {
  BotIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  CircleDotDashedIcon,
  FolderPlusIcon,
  ListFilterIcon,
  LoaderCircleIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  Trash2Icon,
  WrenchIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  buildAgentTaskPrompt,
  type ProjectTask,
  type ProjectTaskCategory,
  type ProjectTaskStatus,
  useProjectDashboardStore,
} from "../../dashboardStore";
import { useNewThreadHandler } from "../../hooks/useHandleNewThread";
import { selectProjectGroupingSettings } from "../../logicalProject";
import { buildSidebarProjectSnapshots } from "../../sidebarProjectGrouping";
import { useProjects, useThreadShells } from "../../state/entities";
import { useEnvironments, usePrimaryEnvironmentId } from "../../state/environments";
import { openCommandPalette } from "../../commandPaletteBus";
import { useClientSettings } from "../../hooks/useSettings";
import { formatRelativeTimeLabel } from "../../timestampFormat";
import { cn } from "../../lib/utils";
import { ProjectFavicon } from "../ProjectFavicon";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { SidebarInset } from "../ui/sidebar";
import { Textarea } from "../ui/textarea";
import { COLLAPSED_SIDEBAR_TITLEBAR_INSET_CLASS } from "../../workspaceTitlebar";

const CATEGORY_META: Record<
  ProjectTaskCategory,
  { readonly label: string; readonly className: string }
> = {
  fix: {
    label: "Fix",
    className: "bg-red-500/8 text-red-600 dark:bg-red-400/10 dark:text-red-300",
  },
  feature: {
    label: "Feature",
    className: "bg-blue-500/8 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300",
  },
  maintenance: {
    label: "Maintenance",
    className: "bg-amber-500/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
  },
  idea: {
    label: "Idea",
    className: "bg-violet-500/8 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300",
  },
};

const STATUS_META: Record<
  ProjectTaskStatus,
  { readonly label: string; readonly next: ProjectTaskStatus }
> = {
  todo: { label: "Ready", next: "in-progress" },
  "in-progress": { label: "Working", next: "review" },
  review: { label: "Review", next: "done" },
  done: { label: "Done", next: "todo" },
};

function relativeProjectActivity(updatedAt: string): string {
  const label = formatRelativeTimeLabel(updatedAt);
  return label ? `Touched ${label}` : "Recently added";
}

function matchesSearch(
  projectTitle: string,
  description: string,
  tasks: readonly ProjectTask[],
  query: string,
): boolean {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return true;
  return [projectTitle, description, ...tasks.flatMap((task) => [task.title, task.details])]
    .join("\n")
    .toLocaleLowerCase()
    .includes(normalized);
}

export function ProjectDashboard() {
  const projects = useProjects();
  const threads = useThreadShells();
  const { environments } = useEnvironments();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const groupingSettings = useClientSettings(selectProjectGroupingSettings);
  const entries = useProjectDashboardStore((state) => state.entriesByProjectKey);
  const [query, setQuery] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  const environmentLabels = useMemo(
    () =>
      new Map(
        environments.map((environment) => [
          environment.environmentId,
          environment.label?.trim() || "Remote",
        ]),
      ),
    [environments],
  );
  const projectGroups = useMemo(
    () =>
      buildSidebarProjectSnapshots({
        projects,
        settings: groupingSettings,
        primaryEnvironmentId,
        resolveEnvironmentLabel: (environmentId) => environmentLabels.get(environmentId) ?? null,
      }),
    [environmentLabels, groupingSettings, primaryEnvironmentId, projects],
  );

  const runningProjectRefs = useMemo(
    () =>
      new Set(
        threads
          .filter(
            (thread) =>
              thread.latestTurn?.state === "running" ||
              thread.hasPendingApprovals ||
              thread.hasPendingUserInput,
          )
          .map((thread) => `${thread.environmentId}:${thread.projectId}`),
      ),
    [threads],
  );

  const visibleGroups = projectGroups.filter((project) => {
    const entry = entries[project.projectKey];
    return matchesSearch(project.displayName, entry?.description ?? "", entry?.tasks ?? [], query);
  });
  const allTasks = projectGroups.flatMap((project) => entries[project.projectKey]?.tasks ?? []);
  const readyCount = allTasks.filter((task) => task.status === "todo").length;
  const reviewCount = allTasks.filter((task) => task.status === "review").length;
  const activeCount = projectGroups.filter((project) =>
    project.memberProjects.some((member) =>
      runningProjectRefs.has(`${member.environmentId}:${member.id}`),
    ),
  ).length;

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden bg-background text-foreground">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className={cn(
            "shrink-0 border-b border-border/70 bg-background/92 px-4 pb-4 pt-[calc(var(--workspace-topbar-height)+0.5rem)] backdrop-blur-xl sm:px-7",
            COLLAPSED_SIDEBAR_TITLEBAR_INSET_CLASS,
          )}
        >
          <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                  <CircleDotDashedIcon className="size-3.5" />
                  Project fieldbook
                </div>
                <h1 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
                  What deserves your attention?
                </h1>
                <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
                  Keep the next move visible. Hand a bounded task to an agent when you’re ready.
                </p>
              </div>
              <Button size="sm" onClick={() => openCommandPalette({ open: "add-project" })}>
                <FolderPlusIcon className="size-4" />
                Add project
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-56 flex-1 sm:max-w-md">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 z-10 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  nativeInput
                  value={query}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                  placeholder="Search projects and tasks"
                  className="rounded-md [&_input]:pl-8"
                />
              </div>
              <Button
                size="sm"
                variant={showCompleted ? "secondary" : "outline"}
                onClick={() => setShowCompleted((current) => !current)}
                aria-pressed={showCompleted}
              >
                <ListFilterIcon className="size-3.5" />
                {showCompleted ? "Hide completed" : "Show completed"}
              </Button>
              <div className="ml-auto hidden items-center gap-4 text-xs text-muted-foreground lg:flex">
                <span>
                  <strong className="font-semibold text-foreground">{readyCount}</strong> ready
                </span>
                <span>
                  <strong className="font-semibold text-foreground">{activeCount}</strong> active
                </span>
                <span>
                  <strong className="font-semibold text-foreground">{reviewCount}</strong> to review
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-7 sm:py-7">
            {visibleGroups.length > 0 ? (
              <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {visibleGroups.map((project, index) => (
                  <ProjectCard
                    key={project.projectKey}
                    project={project}
                    running={project.memberProjects.some((member) =>
                      runningProjectRefs.has(`${member.environmentId}:${member.id}`),
                    )}
                    showCompleted={showCompleted}
                    style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
                  />
                ))}
              </div>
            ) : (
              <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/20 px-8 text-center">
                <SearchIcon className="mb-4 size-5 text-muted-foreground/60" />
                <h2 className="font-medium">No projects match that search</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try a project name, task, feature, or fix.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </SidebarInset>
  );
}

function ProjectCard({
  project,
  running,
  showCompleted,
  style,
}: {
  readonly project: ReturnType<typeof buildSidebarProjectSnapshots>[number];
  readonly running: boolean;
  readonly showCompleted: boolean;
  readonly style: React.CSSProperties;
}) {
  const entry = useProjectDashboardStore((state) => state.entriesByProjectKey[project.projectKey]);
  const setProjectDescription = useProjectDashboardStore((state) => state.setProjectDescription);
  const updateTask = useProjectDashboardStore((state) => state.updateTask);
  const handleNewThread = useNewThreadHandler();
  const [description, setDescription] = useState(entry?.description ?? "");
  const [addingTask, setAddingTask] = useState(false);
  const tasks = (entry?.tasks ?? []).filter((task) => showCompleted || task.status !== "done");
  const hiddenCompletedCount = (entry?.tasks ?? []).filter((task) => task.status === "done").length;
  const readyCount = (entry?.tasks ?? []).filter((task) => task.status === "todo").length;

  const target = project.memberProjects[0]!;
  const openProject = () =>
    handleNewThread(scopeProjectRef(target.environmentId, target.id), { forceNew: true });
  const runTask = async (task: ProjectTask) => {
    updateTask(project.projectKey, task.id, { status: "in-progress" });
    await handleNewThread(scopeProjectRef(target.environmentId, target.id), {
      forceNew: true,
      initialPrompt: buildAgentTaskPrompt({
        projectTitle: project.displayName,
        projectDescription: description,
        task,
      }),
    });
  };

  return (
    <article
      style={style}
      className="group/card animate-in fade-in slide-in-from-bottom-2 overflow-hidden rounded-xl border border-border/75 bg-card/65 shadow-[0_1px_0_color-mix(in_srgb,var(--foreground)_4%,transparent)] duration-500"
    >
      <div className="border-b border-border/60 px-4 pb-3.5 pt-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background/80 shadow-sm/5">
            <ProjectFavicon
              environmentId={target.environmentId}
              cwd={target.workspaceRoot}
              className="size-5"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-[15px] font-semibold tracking-[-0.015em]">
                {project.displayName}
              </h2>
              {running ? (
                <Badge variant="info" size="sm" className="gap-1">
                  <LoaderCircleIcon className="size-3 animate-spin" />
                  Active
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/72">
              {target.workspaceRoot}
            </p>
          </div>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`Open ${project.displayName}`}
            onClick={() => void openProject()}
          >
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </div>
        <Textarea
          unstyled
          rows={2}
          value={description}
          onChange={(event) => {
            const nextDescription = event.currentTarget.value;
            setDescription(nextDescription);
            setProjectDescription(project.projectKey, nextDescription);
          }}
          placeholder="Add a one-line description of this project…"
          className="mt-3 min-h-0 resize-none rounded-md bg-transparent px-0 py-0 text-sm leading-5 text-muted-foreground outline-none placeholder:text-muted-foreground/45 focus:text-foreground"
        />
      </div>

      <div className="px-3 py-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            <WrenchIcon className="size-3.5" />
            Next work
          </div>
          <span className="text-[11px] text-muted-foreground">{readyCount} ready</span>
        </div>

        <div className="space-y-1">
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <TaskRow
                key={task.id}
                projectKey={project.projectKey}
                task={task}
                onRun={() => void runTask(task)}
              />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-border/70 px-3 py-5 text-center">
              <p className="text-xs text-muted-foreground">
                {hiddenCompletedCount > 0
                  ? "Everything visible is done."
                  : "No tasks captured yet."}
              </p>
            </div>
          )}
        </div>

        {addingTask ? (
          <NewTaskForm projectKey={project.projectKey} onClose={() => setAddingTask(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setAddingTask(true)}
            className="mt-2 flex h-8 w-full items-center gap-2 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/55 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PlusIcon className="size-3.5" />
            Add a fix, feature, or idea
          </button>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-border/55 bg-muted/18 px-4 py-2.5">
        <span className="text-[10px] text-muted-foreground/72">
          {relativeProjectActivity(project.updatedAt)}
        </span>
        <Button size="xs" variant="ghost" onClick={() => void openProject()}>
          Open workspace
        </Button>
      </footer>
    </article>
  );
}

function TaskRow({
  projectKey,
  task,
  onRun,
}: {
  readonly projectKey: string;
  readonly task: ProjectTask;
  readonly onRun: () => void;
}) {
  const updateTask = useProjectDashboardStore((state) => state.updateTask);
  const removeTask = useProjectDashboardStore((state) => state.removeTask);
  const [expanded, setExpanded] = useState(false);
  const category = CATEGORY_META[task.category];
  const status = STATUS_META[task.status];

  return (
    <div
      className={cn(
        "group/task rounded-lg border border-transparent transition-colors hover:border-border/65 hover:bg-background/55",
        task.status === "done" && "opacity-55",
      )}
    >
      <div className="flex items-start gap-2 px-2 py-2">
        <button
          type="button"
          className={cn(
            "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
            task.status === "done"
              ? "border-emerald-500/50 bg-emerald-500/12 text-emerald-600"
              : task.status === "in-progress"
                ? "border-blue-500/50 bg-blue-500/10 text-blue-600"
                : "border-border bg-background text-transparent hover:border-foreground/35",
          )}
          onClick={() => updateTask(projectKey, task.id, { status: STATUS_META[task.status].next })}
          aria-label={`Mark ${task.title} as ${STATUS_META[task.status].next}`}
        >
          {task.status === "done" ? (
            <CheckCircle2Icon className="size-3.5" />
          ) : task.status === "in-progress" ? (
            <span className="size-1.5 rounded-full bg-current" />
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="min-w-0 flex-1 text-left focus-visible:outline-none"
        >
          <span
            className={cn(
              "block text-[13px] font-medium leading-4.5",
              task.status === "done" && "line-through",
            )}
          >
            {task.title}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-sm px-1.5 py-0.5 text-[9px] font-semibold",
                category.className,
              )}
            >
              {category.label}
            </span>
            <span className="text-[10px] text-muted-foreground">{status.label}</span>
            {task.details ? (
              <ChevronDownIcon
                className={cn(
                  "size-3 text-muted-foreground transition-transform",
                  expanded && "rotate-180",
                )}
              />
            ) : null}
          </span>
        </button>
        {task.status !== "done" ? (
          <Button
            size="icon-xs"
            variant="ghost"
            className="opacity-0 transition-opacity group-focus-within/task:opacity-100 group-hover/task:opacity-100"
            onClick={onRun}
            aria-label={`Open ${task.title} in an agent`}
          >
            <BotIcon className="size-3.5" />
          </Button>
        ) : null}
        <Button
          size="icon-xs"
          variant="ghost"
          className="opacity-0 transition-opacity group-focus-within/task:opacity-100 group-hover/task:opacity-100"
          onClick={() => removeTask(projectKey, task.id)}
          aria-label={`Delete ${task.title}`}
        >
          <Trash2Icon className="size-3.5" />
        </Button>
      </div>
      {expanded && task.details ? (
        <p className="border-t border-border/50 px-8 py-2 text-xs leading-relaxed text-muted-foreground">
          {task.details}
        </p>
      ) : null}
    </div>
  );
}

function NewTaskForm({
  projectKey,
  onClose,
}: {
  readonly projectKey: string;
  readonly onClose: () => void;
}) {
  const addTask = useProjectDashboardStore((state) => state.addTask);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [category, setCategory] = useState<ProjectTaskCategory>("fix");

  const submit = () => {
    if (!title.trim()) return;
    addTask(projectKey, { title, details, category });
    onClose();
  };

  return (
    <div className="mt-2 rounded-lg border border-border/75 bg-background/65 p-2.5 shadow-sm/5">
      <Input
        nativeInput
        autoFocus
        size="sm"
        value={title}
        onChange={(event) => setTitle(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
          if (event.key === "Escape") onClose();
        }}
        placeholder="What needs to change?"
      />
      <Textarea
        size="sm"
        rows={2}
        value={details}
        onChange={(event) => setDetails(event.currentTarget.value)}
        placeholder="Context or acceptance criteria (optional)"
        className="mt-2"
      />
      <div className="mt-2 flex items-center gap-2">
        <label className="relative">
          <span className="sr-only">Task category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.currentTarget.value as ProjectTaskCategory)}
            className="h-7 appearance-none rounded-md border border-input bg-background py-0 pl-2 pr-7 text-xs text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          >
            {Object.entries(CATEGORY_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
        </label>
        <div className="ml-auto flex gap-1.5">
          <Button size="xs" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button size="xs" onClick={submit} disabled={!title.trim()}>
            <SparklesIcon className="size-3" />
            Add task
          </Button>
        </div>
      </div>
    </div>
  );
}
