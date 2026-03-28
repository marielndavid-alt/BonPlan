export interface Recipe {
  id: string;
  title: string;
  description?: string;
  image?: string;
  category: 'main' | 'snack';
  prepTime: number;
  servings: number;
  difficulty?: string;
  tags: string[];
  instructions?: string;
  ingredients?: RecipeIngredient[];
  totalPrice: number;
  bestStore: string;
  createdAt?: string;
}

export interface RecipeIngredient {
  id: string;
  recipeId: string;
  productId: string;
  productName?: string;
  quantity: number;
  unit: string;
  notes?: string;
  optional?: boolean;
  prices?: ProductPrice[];
}

export interface Product {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  unit: string;
  imageUrl?: string;
  prices?: ProductPrice[];
  createdAt?: string;
}

export interface ProductPrice {
  id: string;
  productId: string;
  storeCode: string;
  price: number;
  unit?: string;
  perUnitPrice?: number;
  scrapedAt?: string;
  expiresAt?: string;
}

export interface Deal {
  id: string;
  store_code: string;
  store_name?: string;
  product_name: string;
  original_price?: number;
  sale_price?: number;
  discount_percentage?: number;
  unit?: string;
  image_url?: string;
  product_category?: string;
  valid_from?: string;
  valid_to?: string;
  scraped_at?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  avatarUrl?: string;
  postalCode?: string;
  phone?: string;
  isAdmin?: boolean;
  createdAt?: string;
}

export interface Subscription {
  id: string;
  userId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  status: 'trialing' | 'active' | 'canceled' | 'past_due' | 'inactive';
  trialStart?: string;
  trialEnd?: string;
  currentPeriodEnd?: string;
}

export interface WeeklyMenuItem {
  id: string;
  userId?: string;
  recipeId: string;
  title?: string;
  day?: DayOfWeek | null;
  servings?: number;
  totalPrice?: number;
  createdAt?: string;
}

export type DayOfWeek = 'Lundi' | 'Mardi' | 'Mercredi' | 'Jeudi' | 'Vendredi' | 'Samedi' | 'Dimanche';

export type ShoppingListCategory = 'frozen' | 'pantry' | 'produce' | 'dairy' | 'meat' | 'fish';

export interface ShoppingListItem {
  id: string;
  userId?: string;
  name: string;
  quantity: string | number;
  unit: string;
  price: number;
  store: string;
  checked: boolean;
  category?: ShoppingListCategory;
  note?: string;
  photo?: string;
  createdAt?: string;
}

export interface PantryItem {
  id: string;
  userId?: string;
  name: string;
  quantity?: number;
  unit?: string;
  expiryDate?: string;
  createdAt?: string;
}

export interface HouseholdMember {
  id: string;
  ownerId: string;
  memberEmail: string;
  memberName?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt?: string;
}
