import React, { useEffect, useState } from 'react';
import {
  Check,
  ChevronLeft,
  Cloud,
  CreditCard,
  Crown,
  FileText,
  FolderOpen,
  Loader2,
  Lock,
  Palette,
  RotateCcw,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { InfoSheetDialog } from '../components/ConfirmDialog';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { NavigationShell } from '../components/NavigationShell';
import { useNotes } from '../context/NotesContext';
import {
  BillingConfig,
  fetchBillingConfig,
  startBinancePayCheckout,
  startSslCommerzCheckout,
} from '../services/billingService';

export function PremiumScreen() {
  const {
    account,
    isPremium,
    setIsPremium,
    hasPaidSubscription,
    isPreviewAvailable,
    appControlsConfig,
    activeNotes,
    folders,
    authLoading,
    authError,
    billingBusy,
    signInGoogleAccount,
    restorePurchase,
    showToast,
    goBack,
  } = useNotes();

  const [plan, setPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [billingConfig, setBillingConfig] = useState<BillingConfig | null>(null);
  const [receiptEmail, setReceiptEmail] = useState(account.email || '');
  const [payingProvider, setPayingProvider] = useState<'sslcommerz' | 'binance_pay' | null>(null);

  useEffect(() => {
    if (account.email) setReceiptEmail(account.email);
  }, [account.email]);

  useEffect(() => {
    void fetchBillingConfig().then(setBillingConfig);
  }, []);

  const { freeLimits, premiumControls } = appControlsConfig;
  const { features: premFeatures, pricing } = premiumControls;

  const premiumFeaturesList = [
    {
      icon: FileText,
      title: 'Unlimited notes',
      detail: `No ${freeLimits.maxActiveNotes}-note cap from the Free plan`,
    },
    {
      icon: FolderOpen,
      title: 'Unlimited folders',
      detail: `Organize beyond ${freeLimits.maxFolders} folders`,
    },
    {
      icon: Sparkles,
      title: 'Rich formatting & unlimited photos',
      detail:
        freeLimits.maxImagesPerNote <= 0
          ? 'Headings, quotes, checklists & unlimited photos per note'
          : `Headings, quotes, checklists & more than ${freeLimits.maxImagesPerNote} ${freeLimits.maxImagesPerNote === 1 ? 'photo' : 'photos'} per note`,
    },
    ...(premFeatures.themePalettes
      ? [
          {
            icon: Palette,
            title: 'Premium themes',
            detail: 'Sepia, Sage, and Slate color palettes',
          },
        ]
      : []),
    ...(premFeatures.noteLock
      ? [
          {
            icon: Lock,
            title: '4-digit PIN note lock',
            detail: 'Hide previews and lock private notes',
          },
        ]
      : []),
    ...(premFeatures.driveBackup
      ? [
          {
            icon: Cloud,
            title: 'Cloud backup & restore',
            detail: 'Google Drive backup alongside ZIP export',
          },
        ]
      : []),
  ];

  const monthlyBdtFormatted = Math.round(pricing.monthlyBdt).toLocaleString();
  const yearlyBdtFormatted = Math.round(pricing.yearlyBdt).toLocaleString();
  const monthlyUsdtFormatted = pricing.monthlyUsdt.toFixed(2);
  const yearlyUsdtFormatted = pricing.yearlyUsdt.toFixed(2);

  const annualizedBdt = pricing.monthlyBdt * 12;
  const yearlySavePercent =
    annualizedBdt > 0 && pricing.yearlyBdt < annualizedBdt
      ? Math.round(((annualizedBdt - pricing.yearlyBdt) / annualizedBdt) * 100)
      : 0;

  const bdtPrice =
    plan === 'yearly'
      ? pricing.yearlyBdt.toFixed(2)
      : pricing.monthlyBdt.toFixed(2);
  const usdtPrice =
    plan === 'yearly' ? yearlyUsdtFormatted : monthlyUsdtFormatted;

  const handlePay = async (provider: 'sslcommerz' | 'binance_pay') => {
    const email = (account.email || receiptEmail).trim();
    if (!email || !email.includes('@')) {
      showToast('Enter a valid email or sign in with Google first', 'danger');
      return;
    }

    setPayingProvider(provider);
    try {
      const result =
        provider === 'sslcommerz'
          ? await startSslCommerzCheckout({
              plan,
              email,
              name: account.name || 'Notes User',
            })
          : await startBinancePayCheckout({
              plan,
              email,
            });
      window.location.assign(result.checkoutUrl);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Payment gateway is not configured yet',
        'danger'
      );
      setPayingProvider(null);
    }
  };

  return (
    <NavigationShell showMobileTabs={false}>
      <header className="sticky top-0 z-20 bg-[var(--bg-canvas)]/95 backdrop-blur-md px-4 sm:px-8 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goBack}
            aria-label="Back"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Notes Premium
          </h1>
        </div>
      </header>

      <section className="px-5 sm:px-8 pt-4 pb-14 max-w-lg mx-auto space-y-7">
        {/* Clean Hero */}
        <div className="text-center pt-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
            <Crown className="h-7 w-7" strokeWidth={1.85} />
          </div>

          <h2 className="mt-4 text-2xl sm:text-[28px] font-bold tracking-tight text-[var(--text-primary)]">
            Write without limits
          </h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed">
            Everything you need to write, organize, and keep your notes private.
          </p>
        </div>

        {/* Scannable Feature List */}
        <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--divider)] divide-y divide-[var(--divider)]">
          {premiumFeaturesList.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex items-center gap-3.5 px-5 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {item.title}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-snug">
                    {item.detail}
                  </p>
                </div>
                <Check className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" strokeWidth={2.4} />
              </div>
            );
          })}
        </div>

        {/* Pricing Cards */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPlan('yearly')}
              className={`rounded-2xl p-4 text-left border transition-colors cursor-pointer ${
                plan === 'yearly'
                  ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-card)] border-[var(--divider)]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--accent-primary)]">
                  {yearlySavePercent > 0 ? `Save ${yearlySavePercent}%` : 'Annual'}
                </span>
                <span
                  className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                    plan === 'yearly'
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]'
                      : 'border-[var(--text-secondary)]/40'
                  }`}
                >
                  {plan === 'yearly' && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">Yearly</p>
              <p className="mt-0.5 text-xl font-bold text-[var(--text-primary)] tabular-nums">
                ৳{yearlyBdtFormatted}
                <span className="text-xs font-normal text-[var(--text-secondary)]"> / yr</span>
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--text-secondary)] tabular-nums">
                or ${yearlyUsdtFormatted} USDT
              </p>
            </button>

            <button
              type="button"
              onClick={() => setPlan('monthly')}
              className={`rounded-2xl p-4 text-left border transition-colors cursor-pointer ${
                plan === 'monthly'
                  ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)]'
                  : 'bg-[var(--bg-card)] border-[var(--divider)]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  Flexible
                </span>
                <span
                  className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                    plan === 'monthly'
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]'
                      : 'border-[var(--text-secondary)]/40'
                  }`}
                >
                  {plan === 'monthly' && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">Monthly</p>
              <p className="mt-0.5 text-xl font-bold text-[var(--text-primary)] tabular-nums">
                ৳{monthlyBdtFormatted}
                <span className="text-xs font-normal text-[var(--text-secondary)]"> / mo</span>
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--text-secondary)] tabular-nums">
                or ${monthlyUsdtFormatted} USDT
              </p>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setCheckoutOpen(true)}
            className="w-full min-h-[50px] rounded-full bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] transition-opacity hover:opacity-90 cursor-pointer"
          >
            {isPremium
              ? 'Notes Premium Active'
              : `Continue with ${
                  plan === 'yearly'
                    ? `Yearly (৳${yearlyBdtFormatted} / $${yearlyUsdtFormatted})`
                    : `Monthly (৳${monthlyBdtFormatted} / $${monthlyUsdtFormatted})`
                }`}
          </button>

          <button
            type="button"
            disabled={billingBusy}
            onClick={() => {
              void restorePurchase();
            }}
            className="flex w-full min-h-[42px] items-center justify-center gap-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            {billingBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.85} />
            )}
            Restore Previous Purchase
          </button>
        </div>

        {/* Subtle Plan Mode Switcher (auto-hidden when preview timer expires) */}
        {isPreviewAvailable && !hasPaidSubscription && (
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--text-primary)]">
                Preview Mode
              </p>
              <p className="text-xs text-[var(--text-secondary)] tabular-nums truncate">
                {isPremium
                  ? 'All Premium features unlocked'
                  : `${activeNotes.length}/${freeLimits.maxActiveNotes} notes · ${folders.length}/${freeLimits.maxFolders} folders used`}
              </p>
            </div>

            <div className="flex items-center gap-1 rounded-xl bg-[var(--bg-canvas)] p-1 border border-[var(--divider)] shrink-0">
              <button
                type="button"
                onClick={() => setIsPremium(false)}
                className={`min-h-[32px] px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  !isPremium
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--divider)]'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                Free
              </button>
              <button
                type="button"
                onClick={() => setIsPremium(true)}
                className={`min-h-[32px] px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  isPremium
                    ? 'bg-[var(--accent-primary)] text-[#171717]'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                Premium
              </button>
            </div>
          </div>
        )}
      </section>

      <InfoSheetDialog
        open={checkoutOpen}
        title="Choose Payment Method"
        onClose={() => {
          if (!payingProvider) setCheckoutOpen(false);
        }}
      >
        <div className="space-y-4">
          {!account.email && (
            <div className="space-y-2.5">
              <GoogleSignInButton
                onClick={signInGoogleAccount}
                loading={authLoading}
                label="Sign in with Google for receipt"
              />
              {authError && (
                <p className="rounded-xl bg-[#E45B5B]/10 border border-[#E45B5B]/25 px-3 py-2 text-xs text-[#C62828] dark:text-[#FCA5A5] select-text">
                  {authError}
                </p>
              )}
              <input
                type="email"
                value={receiptEmail}
                onChange={(e) => setReceiptEmail(e.target.value)}
                placeholder="Or enter receipt email address"
                aria-label="Receipt email address"
                className="w-full min-h-[44px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>
          )}

          <button
            type="button"
            disabled={Boolean(payingProvider)}
            onClick={() => {
              void handlePay('sslcommerz');
            }}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--divider)] bg-[var(--bg-canvas)] p-4 text-left hover:border-[var(--accent-primary)] transition-colors disabled:opacity-60 cursor-pointer"
          >
            <span className="flex items-center gap-3 min-w-0">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                {payingProvider === 'sslcommerz' ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CreditCard className="h-5 w-5" strokeWidth={1.85} />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--text-primary)]">
                  BD Debit Card · bKash · Nagad
                </span>
                <span className="block text-xs text-[var(--text-secondary)]">
                  SSLCommerz · ৳{Math.round(Number(bdtPrice)).toLocaleString()} BDT
                </span>
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-[var(--bg-card)] border border-[var(--divider)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
              {billingConfig?.sslcommerzEnabled
                ? billingConfig.sslcommerzMode === 'live'
                  ? 'Live'
                  : 'Sandbox'
                : 'Setup needed'}
            </span>
          </button>

          <button
            type="button"
            disabled={Boolean(payingProvider)}
            onClick={() => {
              void handlePay('binance_pay');
            }}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--divider)] bg-[var(--bg-canvas)] p-4 text-left hover:border-[var(--accent-primary)] transition-colors disabled:opacity-60 cursor-pointer"
          >
            <span className="flex items-center gap-3 min-w-0">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                {payingProvider === 'binance_pay' ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Wallet className="h-5 w-5" strokeWidth={1.85} />
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--text-primary)]">
                  Binance Pay (USDT)
                </span>
                <span className="block text-xs text-[var(--text-secondary)]">
                  Crypto Wallet · ${usdtPrice} USDT
                </span>
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-[var(--bg-card)] border border-[var(--divider)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
              {billingConfig?.binancePayEnabled ? 'Live' : 'Setup needed'}
            </span>
          </button>

          {(!billingConfig?.sslcommerzEnabled || !billingConfig?.binancePayEnabled) && (
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Gateways marked <span className="font-medium text-[var(--text-primary)]">Setup needed</span>{' '}
              require merchant API credentials in server environment secrets before live or sandbox
              checkout can proceed.
            </p>
          )}
        </div>
      </InfoSheetDialog>
    </NavigationShell>
  );
}

