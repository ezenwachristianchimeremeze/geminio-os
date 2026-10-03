/**
 * Payment Integration Module
 * Handles RevenueCat, Stripe, paywalls, and subscription management
 */

/**
 * RevenueCat Integration
 */
export interface RevenueCatProduct {
  identifier: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  priceString: string;
}

export interface RevenueCatEntitlement {
  identifier: string;
  isActive: boolean;
  expirationDate?: Date;
}

export interface RevenueCatCustomerInfo {
  originalAppUserId: string;
  allPurchasedProductIdentifiers: string[];
  allExpirationDates: Record<string, Date>;
  entitlements: Record<string, RevenueCatEntitlement>;
  originalPurchaseDate?: Date;
  requestDate: Date;
  managementURL?: string;
}

export class RevenueCatClient {
  private apiKey: string;
  private baseUrl = 'https://api.revenuecat.com/v1';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.REVENUECAT_API_KEY || '';
    if (!this.apiKey) throw new Error('RevenueCat API key not configured');
  }

  async getProducts(appUserId: string): Promise<RevenueCatProduct[]> {
    const response = await fetch(`${this.baseUrl}/subscribers/${appUserId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) throw new Error(`RevenueCat error: ${response.statusText}`);

    const data = await response.json();
    return data.subscriber?.products || [];
  }

  async getCustomerInfo(appUserId: string): Promise<RevenueCatCustomerInfo> {
    const response = await fetch(`${this.baseUrl}/subscribers/${appUserId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) throw new Error(`RevenueCat error: ${response.statusText}`);

    const data = await response.json();
    return data.subscriber;
  }

  async checkEntitlement(appUserId: string, entitlementId: string): Promise<boolean> {
    const customerInfo = await this.getCustomerInfo(appUserId);
    const entitlement = customerInfo.entitlements[entitlementId];
    return entitlement?.isActive || false;
  }

  async restorePurchases(appUserId: string): Promise<RevenueCatCustomerInfo> {
    const response = await fetch(`${this.baseUrl}/subscribers/${appUserId}/restore`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) throw new Error(`RevenueCat error: ${response.statusText}`);

    const data = await response.json();
    return data.subscriber;
  }
}

/**
 * Stripe Integration
 */
export interface StripeProduct {
  id: string;
  name: string;
  description?: string;
  prices: StripePrice[];
}

export interface StripePrice {
  id: string;
  productId: string;
  amount: number;
  currency: string;
  interval?: 'month' | 'year';
  intervalCount?: number;
}

export interface StripeCheckoutSession {
  id: string;
  url: string;
  clientSecret?: string;
}

export interface StripeSubscription {
  id: string;
  customerId: string;
  status: 'active' | 'past_due' | 'canceled' | 'unpaid';
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  items: Array<{
    priceId: string;
    quantity: number;
  }>;
}

export class StripeClient {
  private apiKey: string;
  private baseUrl = 'https://api.stripe.com/v1';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.STRIPE_SECRET_KEY || '';
    if (!this.apiKey) throw new Error('Stripe API key not configured');
  }

  private getAuthHeader(): string {
    return 'Basic ' + Buffer.from(`${this.apiKey}:`).toString('base64');
  }

  async createCheckoutSession(
    priceId: string,
    customerId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<StripeCheckoutSession> {
    const params = new URLSearchParams({
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'customer': customerId,
      'mode': 'subscription',
      'success_url': successUrl,
      'cancel_url': cancelUrl,
    });

    const response = await fetch(`${this.baseUrl}/checkout/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) throw new Error(`Stripe error: ${response.statusText}`);

    const data = await response.json();
    return {
      id: data.id,
      url: data.url,
      clientSecret: data.client_secret,
    };
  }

  async getSubscription(subscriptionId: string): Promise<StripeSubscription> {
    const response = await fetch(`${this.baseUrl}/subscriptions/${subscriptionId}`, {
      headers: {
        'Authorization': this.getAuthHeader(),
      },
    });

    if (!response.ok) throw new Error(`Stripe error: ${response.statusText}`);

    const data = await response.json();
    return {
      id: data.id,
      customerId: data.customer,
      status: data.status,
      currentPeriodEnd: new Date(data.current_period_end * 1000),
      cancelAtPeriodEnd: data.cancel_at_period_end,
      items: data.items.data.map((item: any) => ({
        priceId: item.price.id,
        quantity: item.quantity,
      })),
    };
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': this.getAuthHeader(),
      },
    });

    if (!response.ok) throw new Error(`Stripe error: ${response.statusText}`);
  }
}

/**
 * Paywall Management
 */
export interface PaywallConfig {
  id: string;
  title: string;
  subtitle?: string;
  products: Array<{
    productId: string;
    displayName: string;
    description?: string;
    price: string;
    features: string[];
    highlighted?: boolean;
  }>;
  buttons: {
    primary: string;
    secondary?: string;
  };
  backgroundColor?: string;
  textColor?: string;
}

export interface PaywallPresentation {
  config: PaywallConfig;
  onPurchase: (productId: string) => Promise<void>;
  onRestore: () => Promise<void>;
  onDismiss: () => void;
}

export function createPaywall(config: PaywallConfig): PaywallConfig {
  return config;
}

/**
 * Free Trial Management
 */
export interface FreeTrialOffer {
  productId: string;
  trialDays: number;
  trialPrice?: number;
  regularPrice: number;
  currency: string;
}

export interface FreeTrialStatus {
  isEligible: boolean;
  daysRemaining?: number;
  expirationDate?: Date;
}

export async function checkFreeTrialEligibility(
  userId: string,
  productId: string
): Promise<FreeTrialStatus> {
  // Implementation would check user's purchase history
  return {
    isEligible: true,
    daysRemaining: 7,
    expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };
}

/**
 * Receipt Validation
 */
export interface Receipt {
  transactionId: string;
  productId: string;
  purchaseDate: Date;
  expirationDate?: Date;
  isValid: boolean;
}

export async function validateReceipt(
  receiptData: string,
  platform: 'ios' | 'android'
): Promise<Receipt> {
  // Implementation would validate with Apple/Google
  return {
    transactionId: 'mock-transaction-id',
    productId: 'mock-product-id',
    purchaseDate: new Date(),
    isValid: true,
  };
}

/**
 * Promotional Offers
 */
export interface PromotionalOffer {
  id: string;
  productId: string;
  discountPercentage: number;
  validUntil: Date;
  maxRedemptions?: number;
  description?: string;
}

export function createPromotionalOffer(offer: PromotionalOffer): PromotionalOffer {
  return offer;
}

export function isPromotionalOfferValid(offer: PromotionalOffer): boolean {
  return offer.validUntil > new Date();
}

/**
 * Subscription Management
 */
export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly';
  features: string[];
  maxUsers?: number;
  storageGB?: number;
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  FREE: {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'USD',
    billingCycle: 'monthly',
    features: ['Basic features', '1GB storage'],
  },
  PRO: {
    id: 'pro',
    name: 'Pro',
    price: 9.99,
    currency: 'USD',
    billingCycle: 'monthly',
    features: ['All features', '100GB storage', 'Priority support'],
    storageGB: 100,
  },
  ENTERPRISE: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 99.99,
    currency: 'USD',
    billingCycle: 'yearly',
    features: ['All features', 'Unlimited storage', '24/7 support', 'Custom integrations'],
    maxUsers: 999,
    storageGB: 999999,
  },
};
