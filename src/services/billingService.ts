export type BillingPlan = 'monthly' | 'yearly';

export interface BillingConfig {
  serverReachable: boolean;
  sslcommerzEnabled: boolean;
  sslcommerzMode: 'sandbox' | 'live';
  binancePayEnabled: boolean;
  plans: {
    monthly: { bdt: string; usdt: string };
    yearly: { bdt: string; usdt: string };
  };
}

export interface VerifiedPurchase {
  tranId: string;
  provider: 'sslcommerz' | 'binance_pay';
  plan: BillingPlan;
  amount: string;
  currency: 'BDT' | 'USDT';
  email: string;
  status: string;
  receiptToken?: string;
  verifiedAt?: string;
  expiresAt?: string;
}

const DEFAULT_CONFIG: BillingConfig = {
  serverReachable: false,
  sslcommerzEnabled: false,
  sslcommerzMode: 'sandbox',
  binancePayEnabled: false,
  plans: {
    monthly: { bdt: '590.00', usdt: '4.99' },
    yearly: { bdt: '4790.00', usdt: '39.99' },
  },
};

function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
  return `${base}${path}`;
}

export async function fetchBillingConfig(): Promise<BillingConfig> {
  try {
    const res = await fetch(apiUrl('/api/billing/config'));
    if (!res.ok) return DEFAULT_CONFIG;
    const data = (await res.json()) as Partial<BillingConfig>;
    return {
      serverReachable: true,
      sslcommerzEnabled: Boolean(data.sslcommerzEnabled),
      sslcommerzMode: data.sslcommerzMode === 'live' ? 'live' : 'sandbox',
      binancePayEnabled: Boolean(data.binancePayEnabled),
      plans: data.plans || DEFAULT_CONFIG.plans,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function startSslCommerzCheckout(params: {
  plan: BillingPlan;
  email: string;
  name: string;
}): Promise<{ tranId: string; checkoutUrl: string }> {
  const returnOrigin =
    typeof window !== 'undefined' && window.location.origin.startsWith('http')
      ? window.location.origin
      : '';
  const res = await fetch(apiUrl('/api/billing/sslcommerz/init'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, returnOrigin }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    tranId?: string;
    checkoutUrl?: string;
    error?: string;
  };
  if (!res.ok || !data.checkoutUrl || !data.tranId) {
    throw new Error(data.error || 'Could not start SSLCommerz checkout');
  }
  return { tranId: data.tranId, checkoutUrl: data.checkoutUrl };
}

export async function startBinancePayCheckout(params: {
  plan: BillingPlan;
  email: string;
}): Promise<{ tranId: string; checkoutUrl: string }> {
  const returnOrigin =
    typeof window !== 'undefined' && window.location.origin.startsWith('http')
      ? window.location.origin
      : '';
  const res = await fetch(apiUrl('/api/billing/binance/create'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, returnOrigin }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    tranId?: string;
    checkoutUrl?: string;
    error?: string;
  };
  if (!res.ok || !data.checkoutUrl || !data.tranId) {
    throw new Error(data.error || 'Could not start Binance Pay checkout');
  }
  return { tranId: data.tranId, checkoutUrl: data.checkoutUrl };
}

export async function verifyPurchaseTransaction(tranId: string): Promise<{
  verified: boolean;
  purchase?: VerifiedPurchase;
  error?: string;
}> {
  const res = await fetch(
    apiUrl(`/api/billing/verify?tran_id=${encodeURIComponent(tranId)}`)
  );
  const data = (await res.json().catch(() => ({}))) as {
    verified?: boolean;
    purchase?: VerifiedPurchase;
    error?: string;
  };
  return {
    verified: Boolean(data.verified),
    purchase: data.purchase,
    error: data.error,
  };
}

export async function restorePurchaseOnServer(params: {
  email?: string;
  transactionId?: string;
}): Promise<{
  restored: boolean;
  purchase?: VerifiedPurchase;
  message?: string;
}> {
  const res = await fetch(apiUrl('/api/billing/restore'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = (await res.json().catch(() => ({}))) as {
    restored?: boolean;
    purchase?: VerifiedPurchase;
    message?: string;
    error?: string;
  };
  if (!res.ok && !data.message) {
    throw new Error(data.error || 'Could not verify purchase history');
  }
  return {
    restored: Boolean(data.restored),
    purchase: data.purchase,
    message: data.message || data.error,
  };
}
