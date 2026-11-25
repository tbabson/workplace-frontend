import type { Department } from '../types';

/** "Admin › HR" for a sub-department, plain name otherwise. */
export function departmentLabel(d: Department, all: Department[]): string {
  const parent = d.parent_id ? all.find((p) => p.id === d.parent_id) : undefined;
  return parent ? `${parent.name} › ${d.name}` : d.name;
}

/**
 * Departments ordered for a dropdown: each top-level department followed by its
 * sub-departments, e.g. Admin, Admin › HR, Finishing, Marketing, Marketing › Digital Marketing.
 */
export function departmentOptions(all: Department[] | undefined): { value: string; label: string }[] {
  const list = all ?? [];
  const byName = (a: Department, b: Department) => a.name.localeCompare(b.name);
  const ids = new Set(list.map((d) => d.id));
  // Treat a sub-department whose parent is missing as top-level, so it still shows.
  const topLevel = list.filter((d) => !d.parent_id || !ids.has(d.parent_id)).sort(byName);
  return topLevel.flatMap((parent) => [
    { value: parent.id, label: parent.name },
    ...list
      .filter((c) => c.parent_id === parent.id)
      .sort(byName)
      .map((c) => ({ value: c.id, label: departmentLabel(c, list) })),
  ]);
}

/**
 * Whether a user in `userDeptId` falls under `headDeptId`'s oversight: the same
 * department, or one of its sub-departments. Mirrors the backend's dept-head rule.
 */
export function isInDepartmentTree(
  userDeptId: string | null | undefined,
  headDeptId: string | null | undefined,
  all: Department[] | undefined,
): boolean {
  if (!userDeptId || !headDeptId) return false;
  if (userDeptId === headDeptId) return true;
  return (all ?? []).some((d) => d.id === userDeptId && d.parent_id === headDeptId);
}
