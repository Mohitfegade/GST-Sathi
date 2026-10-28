'use client';

import React, { useState, useTransition, useId } from 'react';
import { useRouter } from 'next/navigation';
import type { ClientForm } from '@/lib/clients/types';
import type { ActionResult } from '@/lib/auth/types';
import type { Scheme, AatoBand, Lang } from '@/lib/domain/tenancy';
import { stateFromGstin, validateGstin } from '@/lib/gst/gstin';

export interface ClientFormFieldsProps {
  initialValues?: Partial<ClientForm>;
  clientId?: string;
  submitAction: (data: ClientForm) => Promise<ActionResult<{ id: string }>>;
  submitLabel?: string;
  cancelHref?: string;
}

const SCHEME_OPTIONS: Array<{ value: Scheme; label: string; helper: string }> = [
  {
    value: 'regular',
    label: 'Regular scheme',
    helper: 'Monthly filing with full input tax credit.',
  },
  {
    value: 'qrmp',
    label: 'QRMP scheme',
    helper: 'Quarterly returns with monthly tax payments (turnover up to ₹5 Crore).',
  },
  {
    value: 'composition',
    label: 'Composition scheme',
    helper: 'Quarterly flat-rate payment for small shops (turnover up to ₹1.5 Crore).',
  },
];

const AATO_OPTIONS: Array<{ value: AatoBand; label: string; helper: string }> = [
  {
    value: 'below_40l',
    label: 'Below ₹40 Lakhs',
    helper: 'Eligible for exemption or composition scheme.',
  },
  {
    value: '40l_to_1_5cr',
    label: '₹40 Lakhs to ₹1.5 Crore',
    helper: 'Eligible for composition scheme or regular filing.',
  },
  {
    value: '1_5cr_to_5cr',
    label: '₹1.5 Crore to ₹5 Crore',
    helper: 'Eligible for QRMP quarterly return scheme.',
  },
  {
    value: 'above_5cr',
    label: 'Above ₹5 Crore',
    helper: 'Monthly filing required.',
  },
];

const LANGUAGE_OPTIONS: Array<{ value: Lang; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi (हिंदी)' },
  { value: 'mr', label: 'Marathi (मराठी)' },
];

export function ClientFormFields({
  initialValues,
  clientId,
  submitAction,
  submitLabel = 'Save client',
  cancelHref = '/app/clients',
}: ClientFormFieldsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [legalName, setLegalName] = useState(initialValues?.legal_name || '');
  const [tradeName, setTradeName] = useState(initialValues?.trade_name || '');
  const [gstin, setGstin] = useState(initialValues?.gstin || '');
  const [scheme, setScheme] = useState<Scheme>(initialValues?.scheme || 'regular');
  const [aatoBand, setAatoBand] = useState<AatoBand>(initialValues?.aato_band || 'below_40l');
  const [sellsTaxable, setSellsTaxable] = useState(initialValues?.sells_taxable ?? true);
  const [sellsExempt, setSellsExempt] = useState(initialValues?.sells_exempt ?? false);
  const [language, setLanguage] = useState<Lang>(initialValues?.language || 'en');

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const legalNameId = useId();
  const tradeNameId = useId();
  const gstinId = useId();
  const languageId = useId();

  // Live state detection from GSTIN
  const cleanGstin = gstin.trim().toUpperCase();
  const stateDetection = cleanGstin.length >= 2 ? stateFromGstin(cleanGstin) : null;
  const gstinValidation = cleanGstin.length === 15 ? validateGstin(cleanGstin) : null;

  function handleGstinChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15);
    setGstin(val);
    if (fieldErrors.gstin) {
      setFieldErrors((prev) => ({ ...prev, gstin: '' }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const errors: Record<string, string> = {};

    if (!legalName.trim()) {
      errors.legal_name = 'Please enter the legal business name.';
    }

    if (!cleanGstin) {
      errors.gstin = 'Please enter the GSTIN.';
    } else if (cleanGstin.length !== 15) {
      errors.gstin = 'GSTIN must be exactly 15 characters.';
    } else {
      const gstinResult = validateGstin(cleanGstin);
      if (!gstinResult.valid) {
        errors.gstin = gstinResult.error || 'Please enter a valid GSTIN.';
      }
    }

    if (!sellsTaxable && !sellsExempt) {
      errors.sells = 'Please select at least one: taxable or tax-free goods.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const payload: ClientForm = {
      legal_name: legalName.trim(),
      trade_name: tradeName.trim() || undefined,
      gstin: cleanGstin,
      scheme,
      aato_band: aatoBand,
      sells_taxable: sellsTaxable,
      sells_exempt: sellsExempt,
      language,
    };

    startTransition(async () => {
      try {
        const res = await submitAction(payload);
        if (!res.ok) {
          if (res.field) {
            setFieldErrors({ [res.field]: res.message });
          } else {
            setFormError(res.message);
          }
          return;
        }

        const targetId = res.data?.id || clientId;
        if (targetId) {
          router.push(`/app/clients/${targetId}`);
        } else {
          router.push('/app/clients');
        }
        router.refresh();
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl" noValidate>
      {formError && (
        <div
          role="alert"
          className="rounded-lg border border-line bg-surface p-4 text-ink text-sm font-medium"
        >
          {formError}
        </div>
      )}

      {/* Group 1: Business Details */}
      <fieldset className="rounded-xl border border-line bg-surface/30 p-6 space-y-6">
        <legend className="px-2 text-lg font-semibold text-ink">
          1. Business details
        </legend>

        <div className="space-y-2">
          <label htmlFor={legalNameId} className="block text-sm font-medium text-ink">
            Legal business name <span className="text-muted">*</span>
          </label>
          <input
            id={legalNameId}
            type="text"
            required
            aria-invalid={!!fieldErrors.legal_name}
            aria-describedby={fieldErrors.legal_name ? `${legalNameId}-error` : undefined}
            value={legalName}
            onChange={(e) => {
              setLegalName(e.target.value);
              if (fieldErrors.legal_name) setFieldErrors((p) => ({ ...p, legal_name: '' }));
            }}
            placeholder="e.g. Ramesh Stores Private Limited"
            className="w-full rounded-lg border border-line bg-background px-4 py-3 text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent min-h-[48px]"
          />
          <p className="text-xs text-muted">As registered on the GST certificate.</p>
          {fieldErrors.legal_name && (
            <p id={`${legalNameId}-error`} className="text-sm font-medium text-ink">{fieldErrors.legal_name}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor={tradeNameId} className="block text-sm font-medium text-ink">
            Trade / shop name <span className="text-xs text-muted font-normal">(optional)</span>
          </label>
          <input
            id={tradeNameId}
            type="text"
            value={tradeName}
            onChange={(e) => setTradeName(e.target.value)}
            placeholder="e.g. Ramesh Kirana"
            className="w-full rounded-lg border border-line bg-background px-4 py-3 text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent min-h-[48px]"
          />
          <p className="text-xs text-muted">Name on the storefront or shop board, if different.</p>
        </div>

        <div className="space-y-2">
          <label htmlFor={gstinId} className="block text-sm font-medium text-ink">
            GSTIN <span className="text-muted">*</span>
          </label>
          <input
            id={gstinId}
            type="text"
            required
            maxLength={15}
            aria-invalid={!!fieldErrors.gstin}
            aria-describedby={fieldErrors.gstin ? `${gstinId}-error` : undefined}
            value={gstin}
            onChange={handleGstinChange}
            placeholder="e.g. 27ABCDE1234F1Z5"
            className="w-full font-mono uppercase tracking-wider rounded-lg border border-line bg-background px-4 py-3 text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent min-h-[48px]"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-muted">15-character Goods and Services Tax Identification Number.</span>
            {stateDetection && (
              <span className="font-medium text-ink bg-surface border border-line px-2 py-0.5 rounded">
                State: {stateDetection.name} ({stateDetection.code})
              </span>
            )}
          </div>
          {cleanGstin.length === 15 && gstinValidation && !gstinValidation.valid && (
            <p className="text-xs text-muted">Checksum note: Please double check the last digit.</p>
          )}
          {fieldErrors.gstin && (
            <p id={`${gstinId}-error`} className="text-sm font-medium text-ink">{fieldErrors.gstin}</p>
          )}
        </div>
      </fieldset>

      {/* Group 2: Tax Type & Scheme */}
      <fieldset className="rounded-xl border border-line bg-surface/30 p-6 space-y-6">
        <legend className="px-2 text-lg font-semibold text-ink">
          2. Tax scheme and turnover
        </legend>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-ink">
            GST scheme <span className="text-muted">*</span>
          </label>
          <div className="space-y-2">
            {SCHEME_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                  scheme === opt.value
                    ? 'border-accent bg-surface'
                    : 'border-line bg-background hover:bg-surface/50'
                }`}
              >
                <input
                  type="radio"
                  name="scheme"
                  value={opt.value}
                  checked={scheme === opt.value}
                  onChange={() => setScheme(opt.value)}
                  className="mt-1 h-4 w-4 text-accent focus:ring-accent border-line"
                />
                <div>
                  <span className="block text-base font-medium text-ink">{opt.label}</span>
                  <span className="block text-xs text-muted mt-0.5">{opt.helper}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-ink">
            Yearly turnover band <span className="text-muted">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {AATO_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  aatoBand === opt.value
                    ? 'border-accent bg-surface'
                    : 'border-line bg-background hover:bg-surface/50'
                }`}
              >
                <input
                  type="radio"
                  name="aatoBand"
                  value={opt.value}
                  checked={aatoBand === opt.value}
                  onChange={() => setAatoBand(opt.value)}
                  className="mt-1 h-4 w-4 text-accent focus:ring-accent border-line"
                />
                <div>
                  <span className="block text-sm font-medium text-ink">{opt.label}</span>
                  <span className="block text-xs text-muted mt-0.5">{opt.helper}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      {/* Group 3: What the shop sells & language */}
      <fieldset className="rounded-xl border border-line bg-surface/30 p-6 space-y-6">
        <legend className="px-2 text-lg font-semibold text-ink">
          3. What the shop sells
        </legend>

        <div className="space-y-3">
          <span className="block text-sm font-medium text-ink">
            Supply types <span className="text-muted">*</span>
          </span>
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 rounded-lg border border-line bg-background hover:bg-surface/50 cursor-pointer min-h-[48px]">
              <input
                type="checkbox"
                checked={sellsTaxable}
                onChange={(e) => {
                  setSellsTaxable(e.target.checked);
                  if (fieldErrors.sells) setFieldErrors((p) => ({ ...p, sells: '' }));
                }}
                className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
              />
              <div>
                <span className="block text-sm font-medium text-ink">Sells taxable goods</span>
                <span className="block text-xs text-muted">Standard items subject to GST.</span>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg border border-line bg-background hover:bg-surface/50 cursor-pointer min-h-[48px]">
              <input
                type="checkbox"
                checked={sellsExempt}
                onChange={(e) => {
                  setSellsExempt(e.target.checked);
                  if (fieldErrors.sells) setFieldErrors((p) => ({ ...p, sells: '' }));
                }}
                className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
              />
              <div>
                <span className="block text-sm font-medium text-ink">Sells tax-free (exempt) goods</span>
                <span className="block text-xs text-muted">Fresh vegetables, unbranded grains, or other exempt items.</span>
              </div>
            </label>
          </div>
          {fieldErrors.sells && (
            <p className="text-sm font-medium text-ink">{fieldErrors.sells}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor={languageId} className="block text-sm font-medium text-ink">
            Preferred language
          </label>
          <select
            id={languageId}
            value={language}
            onChange={(e) => setLanguage(e.target.value as Lang)}
            className="w-full rounded-lg border border-line bg-background px-4 py-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-accent min-h-[48px]"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted">Language for notices and owner portal communication.</p>
        </div>
      </fieldset>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-lg bg-accent px-6 py-3 text-base font-semibold text-on-accent hover:bg-accent-hover transition-colors disabled:opacity-50 min-h-[48px]"
        >
          {isPending ? 'Saving client...' : submitLabel}
        </button>

        <a
          href={cancelHref}
          className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-6 py-3 text-base font-medium text-ink hover:bg-surface/80 transition-colors min-h-[48px]"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}

export default ClientFormFields;
