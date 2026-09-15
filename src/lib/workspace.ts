import { getSupabase, isCloudConfigured } from './supabaseClient';

export type WorkspaceRole = 'viewer' | 'editor' | 'admin';

export type WorkspaceMembership = {
  workspaceId: string;
  role: WorkspaceRole;
  libraryOwnerId: string;
  userId: string;
};

export type WorkspaceMember = {
  userId: string;
  email: string;
  role: WorkspaceRole;
  createdAt: string;
};

export function canEditLibrary(role: WorkspaceRole | null | undefined): boolean {
  return role === 'editor' || role === 'admin';
}

export function isLibraryAdmin(role: WorkspaceRole | null | undefined): boolean {
  return role === 'admin';
}

/** Local / non-cloud mode: full edit access, no membership. */
export const LOCAL_MEMBERSHIP: WorkspaceMembership = {
  workspaceId: 'local',
  role: 'admin',
  libraryOwnerId: 'local',
  userId: 'local',
};

type MembershipRow = {
  workspace_id: string;
  role: WorkspaceRole;
  library_owner_id: string;
  user_id: string;
};

export async function ensureWorkspaceMembership(): Promise<WorkspaceMembership> {
  if (!isCloudConfigured()) return LOCAL_MEMBERSHIP;

  const { data, error } = await getSupabase().rpc('ensure_workspace_membership');
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as MembershipRow | undefined;
  if (!row) throw new Error('Failed to join library');

  return {
    workspaceId: row.workspace_id,
    role: row.role,
    libraryOwnerId: row.library_owner_id,
    userId: row.user_id,
  };
}

export async function fetchLibraryOwnerId(): Promise<string> {
  if (!isCloudConfigured()) return 'local';
  const { data, error } = await getSupabase().rpc('library_owner_id');
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Not a library member');
  return data as string;
}

export async function listWorkspaceMembers(): Promise<WorkspaceMember[]> {
  if (!isCloudConfigured()) return [];
  const { data, error } = await getSupabase().rpc('list_workspace_members');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{
    user_id: string;
    email: string;
    role: WorkspaceRole;
    created_at: string;
  }>).map((row) => ({
    userId: row.user_id,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
  }));
}

export async function setMemberRole(
  userId: string,
  role: WorkspaceRole,
): Promise<void> {
  if (!isCloudConfigured()) return;
  const { error } = await getSupabase().rpc('set_member_role', {
    target_user_id: userId,
    new_role: role,
  });
  if (error) throw new Error(error.message);
}
