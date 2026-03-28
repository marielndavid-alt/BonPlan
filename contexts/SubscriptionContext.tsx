import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/template';

interface SubscriptionContextType {
  isSubscribed: boolean;
  isTrial: boolean;
  isAdmin: boolean;
  loading: boolean;
  status: string | null;
  refetch: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  isSubscribed: false,
  isTrial: false,
  isAdmin: false,
  loading: true,
  status: null,
  refetch: () => {},
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState({
    isSubscribed: false,
    isTrial: false,
    isAdmin: false,
    loading: true,
    status: null as string | null,
  });

  const fetchSubscription = async () => {
    if (!user) {
      setState({ isSubscribed: false, isTrial: false, isAdmin: false, loading: false, status: null });
      return;
    }

    setState(s => ({ ...s, loading: true }));

    try {
      // Check admin status
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      // Check subscription
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status, trial_end, current_period_end')
        .eq('user_id', user.id)
        .single();

      const now = new Date();
      let isSubscribed = false;
      let isTrial = false;

      if (sub) {
        if (sub.status === 'active') {
          isSubscribed = true;
        } else if (sub.status === 'trialing') {
          const trialEnd = sub.trial_end ? new Date(sub.trial_end) : null;
          if (trialEnd && trialEnd > now) {
            isTrial = true;
            isSubscribed = true;
          }
        }
      }

      setState({
        isSubscribed,
        isTrial,
        isAdmin: profile?.is_admin || false,
        loading: false,
        status: sub?.status || null,
      });
    } catch (err) {
      console.error('[Subscription] Error:', err);
      setState({ isSubscribed: false, isTrial: false, isAdmin: false, loading: false, status: null });
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, [user?.id]);

  return (
    <SubscriptionContext.Provider value={{ ...state, refetch: fetchSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
