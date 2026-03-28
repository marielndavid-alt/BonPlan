import { supabase } from '@/lib/supabase';

export async function cleanupDuplicateProducts(): Promise<{
  success: boolean;
  duplicatesRemoved: number;
  groupsMerged: number;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('cleanup-duplicate-products', {
      body: {},
    });

    if (error) {
      return { success: false, duplicatesRemoved: 0, groupsMerged: 0, error: error.message };
    }

    return {
      success: true,
      duplicatesRemoved: data?.duplicatesRemoved || 0,
      groupsMerged: data?.groupsMerged || 0,
    };
  } catch (err: any) {
    return { success: false, duplicatesRemoved: 0, groupsMerged: 0, error: err.message };
  }
}
