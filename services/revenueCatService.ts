import Purchases, { LOG_LEVEL, PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';

const REVENUECAT_APPLE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY || 'test_QKfHjtCFUqeEdOQMvkvXEtPTbgK';
const ENTITLEMENT_ID = 'Bon Plan Pro';

export const revenueCatService = {
  async initialize() {
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
    if (Platform.OS === 'ios') {
      await Purchases.configure({ apiKey: REVENUECAT_APPLE_KEY });
    }
  },

  async getOfferings() {
    try {
      const offerings = await Purchases.getOfferings();
      return offerings.current;
    } catch (e) {
      console.error('[RevenueCat] getOfferings:', e);
      return null;
    }
  },

  async purchasePackage(pkg: PurchasesPackage) {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      return { success: true, customerInfo };
    } catch (e: any) {
      if (!e.userCancelled) console.error('[RevenueCat] purchase:', e);
      return { success: false, error: e };
    }
  },

  // Trouve automatiquement le package selon le plan (monthly/yearly) et déclenche l'achat
  async purchasePlan(plan: 'monthly' | 'yearly') {
    try {
      const offerings = await Purchases.getOfferings();
      const current = offerings.current;
      if (!current?.availablePackages?.length) {
        return { success: false, error: { message: 'Aucun forfait disponible pour le moment. Réessayez plus tard.', noOfferings: true } };
      }
      const pkg = current.availablePackages.find(p => {
        const id = p.identifier.toLowerCase();
        if (plan === 'yearly') return id.includes('annual') || id.includes('yearly') || id === '$rc_annual';
        return id.includes('monthly') || id === '$rc_monthly';
      }) || current.availablePackages[0];
      return await this.purchasePackage(pkg);
    } catch (e: any) {
      console.error('[RevenueCat] purchasePlan:', e);
      return { success: false, error: e };
    }
  },

  async restorePurchases() {
    try {
      const customerInfo = await Purchases.restorePurchases();
      return customerInfo;
    } catch (e) {
      console.error('[RevenueCat] restore:', e);
      return null;
    }
  },

  async checkSubscription() {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
    } catch (e) {
      return false;
    }
  },

  async setUserId(userId: string) {
    try {
      await Purchases.logIn(userId);
    } catch (e) {
      console.error('[RevenueCat] setUserId:', e);
    }
  },
};
