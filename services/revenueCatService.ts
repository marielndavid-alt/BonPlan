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
