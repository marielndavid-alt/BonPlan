import { supabase } from '@/lib/supabase';
export interface MissingFormatsJob { id: string; status: string; progress: number; total: number; }
export const createMissingFormatsJob = async (): Promise<MissingFormatsJob> => {
  return { id: Date.now().toString(), status: 'pending', progress: 0, total: 0 };
};
export const getJobStatus = async (jobId: string): Promise<MissingFormatsJob> => {
  return { id: jobId, status: 'completed', progress: 100, total: 100 };
};
export const cancelJob = async (jobId: string) => {};
