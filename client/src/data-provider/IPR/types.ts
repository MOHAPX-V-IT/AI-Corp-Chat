export interface IprEntry {
  ipr_id: string;
  author: { _id: string; name: string; email: string };
  employeeName: string;
  managerName: string;
  employeeDepartment: 'MP' | 'RM' | 'RGR' | 'NEWCOMER_MP';
  eventDate: string;
  classification: string;
  focusSkills: string[];
  summary: string;
  fullAnalysis: string;
  conversationId?: string;
  agentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IprListResponse {
  entries: IprEntry[];
  total: number;
  page: number;
  pages: number;
}

export interface IprListParams {
  tab?: 'mp' | 'rm' | 'rgr' | 'newcomer';
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface IprParseParams {
  conversationId: string;
  agentId?: string;
  newcomerProfileId?: string;
}

export interface IprAnalyzeParams {
  employeeName: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface IprAnalyzeResponse {
  employeeName: string;
  period?: { from?: string; to?: string };
  entriesCount: number;
  analysis: string;
}

export interface IprUpdateParams {
  employeeName?: string;
  managerName?: string;
  eventDate?: string;
  classification?: string;
  focusSkills?: string[];
  summary?: string;
}

export interface IprEmployeeNamesResponse {
  names: string[];
}

export interface IprAnalyzeSelectedParams {
  iprIds: string[];
}

/* ─── Dynamics Dashboard ─── */

export interface IprDynamicsSkill {
  name: string;
  emoji: string;
  scores: number[];
}

export interface IprDynamicsCheckpoint {
  date: string;
  title: string;
  description: string;
  tags: Array<{ text: string; type: 'ok' | 'fail' | 'warn' }>;
}

export interface IprDynamicsRecommendation {
  priority: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  currentProgress: number;
  checkpointProgress: number[];
}

export interface IprActionPlanItem {
  priority: 'critical' | 'high' | 'medium';
  developmentArea: string;
  changeSummary: string;
  actionAlgorithm: string;
  speechModule: string;
  expectedResult: string;
  deadline: string;
}

export interface IprDynamicsData {
  overallScore: { current: number; initial: number };
  iprCompliancePercent: number;
  activeRisks: number;
  initialRisks: number;
  skills: IprDynamicsSkill[];
  checkpoints: IprDynamicsCheckpoint[];
  recommendations: IprDynamicsRecommendation[];
  actionPlan?: IprActionPlanItem[];
  verdict: { title: string; paragraphs: string[] };
}

export interface IprDynamicsResponse {
  employeeName: string;
  employeeDepartment: string;
  managerName: string;
  entriesCount: number;
  period: { from: string; to: string; days: number };
  dynamics: IprDynamicsData;
}

export interface IprSaveDynamicsParams {
  employeeName: string;
  employeeDepartment: string;
  dynamicsJson: string;
  period: { from: string; to: string; days: number };
}

export interface IprAnalyzeDynamicsParams {
  iprIds?: string[];
  employeeName?: string;
  dateFrom?: string;
  dateTo?: string;
}
