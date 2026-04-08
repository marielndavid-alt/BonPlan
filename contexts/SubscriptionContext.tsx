import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/template';
import { revenueCatService } from '@/services/revenueCatService';

interface SubscriptionContextType {
  isSubscribed: boolean;
  isTrial: boolean;
  isAdmin: boolean;
  loading: boolean;
  status: string | null;
  subscriptionStatus: any;
  refetch: () => void;
  refreshSubscription: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  isSubscribed: false,
  isTrial: false,
  isAdmin: false,
  loading: true,
  status: null,
  subscriptionStatus: null,
  refetch: () => {},
  refreshSubscription: () => {},
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState({
    isSubscribed: false,
    isTrial: false,
    isAdmin: false,
    loading: true,
    status: null as string | null,
    subscriptionStatus: null as any,
  });

  const fetchSubscription = async () => {
    if (!user) {
      setState({ isSubscribed: false, isTrial: false, isAdmin: false, loading: false, status: null, subscriptionStatus: null });
      return;
    }

    setState(s => ({ ...s, loading: true }));

    try {
      // Admin status depuis Supabase
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      // Connecter le user à RevenueCat
      await revenueCatService.setUserId(user.id);

      let isSubscribed = false;
      let isTrial = false;
      let status = null;
      let subscriptionStatus = null;

      // Vérifier via RevenueCat
      try {
        const Purchases = require('react-native-purchases').default;
        const customerInfo = await Purchases.getCustomerInfo();
        const entitlement = customerInfo.entitlements.active['Bon Plan Pro'];
        if (entitlement) {
          isSubscribed = true;
          isTrial = entitlement.periodType === 'TRIAL';
          status = isTrial ? 'trialing' : 'active';
          subscriptionStatus = { subscription_end: entitlement.expirationDate };
        }
      } catch (e) {
        console.log('[Subscription] RevenueCat check failed, falling back to Supabase');
      }

      // Fallback vers Supabase si RevenueCat ne trouve rien
      if (!isSubscribed) {
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('status, trial_end, current_period_end')
          .eq('user_id', user.id)
          .single();
        const now = new Date();
        if (sub) {
          if (sub.status === 'active') {
            isSubscribed = true;
            status = 'active';
            subscriptionStatus = { subscription_end: sub.current_period_end };
          } else if (sub.status === 'trialing') {
            const trialEnd = sub.trial_end ? new Date(sub.trial_end) : null;
            if (trialEnd && trialEnd > now) {
              isTrial = true;
              isSubscribed = true;
              status = 'trialing';
              subscriptionStatus = { subscription_end: sub.trial_end };
            }
          }
        }
      }

      setState({
        isSubscribed,
        isTrial,
        isAdmin: profile?.is_admin || false,
        loading: false,
        status,
        subscriptionStatus,
      });
    } catch (err) {
      console.error('[Subscription] Error:', err);
      setState({ isSubscribed: false, isTrial: false, isAdmin: false, loading: false, status: null, subscriptionStatus: null });
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, [user?.id]);

  return (
    <SubscriptionContext.Provider value={{ ...state, refetch: fetchSubscription, refreshSubscription: fetchSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
