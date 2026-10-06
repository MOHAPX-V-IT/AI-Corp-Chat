export const canUseMarketAnalysis = (user?: { email?: string } | null) => Boolean(user?.email);
