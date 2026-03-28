import { supabase } from '@/lib/supabase';

export const onboardingService = {
  async isOnboardingComplete(userId: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('user_preferences')
        .select('selected_stores')
        .eq('user_id', userId)
        .single();
return data !== null;
    } catch {
      return false;
    }
  },

  async savePreferences(data: {
    userId?: string;
    userName?: string;
    postalCode?: string;
    selectedStores?: string[];
    dietaryRestrictions?: string[];
    householdAdults?: number;
    householdChildren?: number;
    notificationsEnabled?: boolean;
  }): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = data.userId || user?.id;
      if (!userId) return false;

      // Sauvegarder nom et code postal dans user_profiles
      if (data.userName || data.postalCode) {
        const result = await supabase.from('user_profiles').update({
  ...(data.userName && { username: data.userName }),
}).eq('id', userId);
                console.log('[Onboarding] user_profiles update:', JSON.stringify(result));

      }

      // Sauvegarder les préférences
     const prefResult = await supabase.from('user_preferences').upsert({

        user_id: userId,
        selected_stores: data.selectedStores || [],
        dietary_restrictions: data.dietaryRestrictions || [],
        household_adults: data.householdAdults || 2,
        household_children: data.householdChildren || 0,
        notifications_enabled: data.notificationsEnabled || false,
        ...(data.postalCode && { postal_code: data.postalCode }),
      }, { onConflict: 'user_id' });
      console.log('[Onboarding] user_preferences upsert:', JSON.stringify(prefResult));


      return true;
    } catch (err) {
      console.error('savePreferences error:', err);
      return false;
    }
  },

  async completeOnboarding(userId: string, data: any): Promise<boolean> {
    return this.savePreferences({ ...data, userId });
  },
  async getPreferences(): Promise<any> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!prefs) return null;

    return {
      postalCode: prefs.postal_code || '',
      household: {
        adults: prefs.household_adults || 2,
        children: [],
        pets: [],
      },
      equipment: [],
      diet: prefs.dietary_restrictions || [],
      excludedIngredients: [],
    };
  } catch {
    return null;
  }
},
};
