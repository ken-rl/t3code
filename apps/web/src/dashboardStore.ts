import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "./lib/storage";

export const PROJECT_DASHBOARD_STORAGE_KEY = "t3code:project-dashboard:v1";

export const PROJECT_TASK_CATEGORIES = ["fix", "feature", "maintenance", "idea"] as const;
export type ProjectTaskCategory = (typeof PROJECT_TASK_CATEGORIES)[number];

export const PROJECT_TASK_STATUSES = ["todo", "in-progress", "review", "done"] as const;
export type ProjectTaskStatus = (typeof PROJECT_TASK_STATUSES)[number];

export interface ProjectTask {
  readonly id: string;
  readonly title: string;
  readonly details: string;
  readonly category: ProjectTaskCategory;
  readonly status: ProjectTaskStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProjectDashboardEntry {
  readonly description: string;
  readonly tasks: ProjectTask[];
  readonly updatedAt: string;
}

interface ProjectDashboardState {
  entriesByProjectKey: Record<string, ProjectDashboardEntry>;
  setProjectDescription: (projectKey: string, description: string) => void;
  addTask: (
    projectKey: string,
    input: Pick<ProjectTask, "title" | "details" | "category">,
  ) => ProjectTask;
  updateTask: (
    projectKey: string,
    taskId: string,
    patch: Partial<Pick<ProjectTask, "title" | "details" | "category" | "status">>,
  ) => void;
  removeTask: (projectKey: string, taskId: string) => void;
}

function emptyEntry(now: string): ProjectDashboardEntry {
  return { description: "", tasks: [], updatedAt: now };
}

let taskIdSequence = 0;

function createTaskId(): string {
  taskIdSequence += 1;
  return `task-${Date.now().toString(36)}-${taskIdSequence.toString(36)}`;
}

export function buildAgentTaskPrompt(input: {
  readonly projectTitle: string;
  readonly projectDescription: string;
  readonly task: Pick<ProjectTask, "title" | "details" | "category">;
}): string {
  const context = input.projectDescription.trim();
  const details = input.task.details.trim();
  return [
    `Work on this ${input.task.category} for ${input.projectTitle}:`,
    "",
    `## Task`,
    input.task.title.trim(),
    ...(details ? ["", "## Details", details] : []),
    ...(context ? ["", "## Project context", context] : []),
    "",
    "Inspect the repository before changing anything. Implement the task, run the smallest relevant checks, and summarize the files changed, verification performed, and anything that still needs my input.",
  ].join("\n");
}

export const useProjectDashboardStore = create<ProjectDashboardState>()(
  persist(
    (set) => ({
      entriesByProjectKey: {},
      setProjectDescription: (projectKey, description) =>
        set((state) => {
          const now = new Date().toISOString();
          const current = state.entriesByProjectKey[projectKey] ?? emptyEntry(now);
          return {
            entriesByProjectKey: {
              ...state.entriesByProjectKey,
              [projectKey]: { ...current, description, updatedAt: now },
            },
          };
        }),
      addTask: (projectKey, input) => {
        const now = new Date().toISOString();
        const task: ProjectTask = {
          id: createTaskId(),
          title: input.title.trim(),
          details: input.details.trim(),
          category: input.category,
          status: "todo",
          createdAt: now,
          updatedAt: now,
        };
        set((state) => {
          const current = state.entriesByProjectKey[projectKey] ?? emptyEntry(now);
          return {
            entriesByProjectKey: {
              ...state.entriesByProjectKey,
              [projectKey]: {
                ...current,
                tasks: [...current.tasks, task],
                updatedAt: now,
              },
            },
          };
        });
        return task;
      },
      updateTask: (projectKey, taskId, patch) =>
        set((state) => {
          const current = state.entriesByProjectKey[projectKey];
          if (!current) return state;
          const now = new Date().toISOString();
          const tasks = current.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  ...patch,
                  ...(patch.title === undefined ? {} : { title: patch.title.trim() }),
                  ...(patch.details === undefined ? {} : { details: patch.details.trim() }),
                  updatedAt: now,
                }
              : task,
          );
          return {
            entriesByProjectKey: {
              ...state.entriesByProjectKey,
              [projectKey]: { ...current, tasks, updatedAt: now },
            },
          };
        }),
      removeTask: (projectKey, taskId) =>
        set((state) => {
          const current = state.entriesByProjectKey[projectKey];
          if (!current) return state;
          const now = new Date().toISOString();
          return {
            entriesByProjectKey: {
              ...state.entriesByProjectKey,
              [projectKey]: {
                ...current,
                tasks: current.tasks.filter((task) => task.id !== taskId),
                updatedAt: now,
              },
            },
          };
        }),
    }),
    {
      name: PROJECT_DASHBOARD_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
      partialize: (state) => ({ entriesByProjectKey: state.entriesByProjectKey }),
    },
  ),
);
