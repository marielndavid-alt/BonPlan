import { useState, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/template';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function useNotifications() {
  const { user } = useAuth();
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkNotificationStatus();
  }, [user?.id]);

  const checkNotificationStatus = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('user_preferences')
        .select('notifications_enabled')
        .eq('user_id', user.id)
        .single();
      setIsEnabled(data?.notifications_enabled || false);
    } catch {
      setIsEnabled(false);
    }
  };

  const registerPushToken = async () => {
    try {
      if (Platform.OS === 'web') return;
      const { data: tokenData } = await Notifications.getExpoPushTokenAsync();
      if (tokenData && user) {
        await supabase
          .from('user_preferences')
          .upsert({ user_id: user.id, push_token: tokenData }, { onConflict: 'user_id' });
      }
    } catch (err) {
      console.error('[Notifications] Token error:', err);
    }
  };

  const toggleNotifications = async (enable: boolean): Promise<boolean> => {
    setLoading(true);
    try {
      if (enable) {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') { setLoading(false); return false; }

        await registerPushToken();

        await Notifications.cancelAllScheduledNotificationsAsync();
        if (Platform.OS !== 'web') {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: '🛒 Nouveaux rabais disponibles !',
              body: 'Découvrez les meilleures promotions de la semaine.',
            },
            trigger: {
              type: 'weekly',
              weekday: 5,
              hour: 11,
              minute: 0,
            } as any,
          });
        }
      } else {
        await Notifications.cancelAllScheduledNotificationsAsync();
      }

      if (user) {
        await supabase
          .from('user_preferences')
          .upsert({ user_id: user.id, notifications_enabled: enable }, { onConflict: 'user_id' });
      }

      setIsEnabled(enable);
      return true;
    } catch (err) {
      console.error('[Notifications] Error:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { isEnabled, loading, toggleNotifications };
}
