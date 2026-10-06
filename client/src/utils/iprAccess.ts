/** Mirrors the existing IPR hierarchy on the server. */
export function canUseIpr(user?: { role?: string; position?: string | null } | null) {
  return user?.role === 'ADMIN' || ['RM', 'RGR', 'ROP', 'TRAINER'].includes(user?.position ?? '');
}
