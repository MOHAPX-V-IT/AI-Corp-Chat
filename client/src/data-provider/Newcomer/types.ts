export interface NewcomerProfile {
  profile_id: string;
  name: string;
  rm: string;
  department: string;
  startDate: string;
  resumeText?: string;
  bigFiveResults?: string;
  managerComments?: string;
  status: 'candidate' | 'onboarding' | 'probation' | 'completed';
  createdBy: { _id: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

export interface NewcomerListResponse {
  profiles: NewcomerProfile[];
  total: number;
  page: number;
  pages: number;
}

export interface NewcomerListParams {
  department?: string;
  status?: string;
  rm?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface NewcomerActiveResponse {
  profiles: Array<Pick<NewcomerProfile, 'profile_id' | 'name' | 'department' | 'status' | 'rm'>>;
}

export interface NewcomerCreateParams {
  name: string;
  rm: string;
  department: string;
  startDate: string;
  resumeText?: string;
  bigFiveResults?: string;
  managerComments?: string;
  status?: string;
}

export type NewcomerUpdateParams = Partial<NewcomerCreateParams>;
