/** Admin roles that may use show/hide on sensitive fields. */
export function isAdminRole(role: string | undefined | null): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export function isSuperAdminRole(role: string | undefined | null): boolean {
  return role === 'SUPER_ADMIN';
}
