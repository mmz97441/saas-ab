import React from 'react';

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  premium?: boolean; // adds amber "Premium" pill next to label
  ariaLabel?: string;
  /**
   * Tailwind bg class for the ON state. Defaults to `bg-brand-700`.
   * SettingsView uses themed colors per section (purple/brand/blue) — pass through
   * the section's accent to preserve the existing visual recipe.
   */
  onColorClass?: string;
}

/**
 * Reusable toggle switch primitive.
 *
 * Two layouts:
 *  - With `label`: label (+ optional description + optional Premium pill) on the LEFT,
 *    track + knob on the RIGHT. Self-contained row.
 *  - Without `label`: just the track + knob (+ optional Premium pill before it),
 *    intended to be embedded next to an existing section header.
 *
 * Visual recipe — matches the 3 inline toggles previously inlined in SettingsView
 * (Marge, Assistant IA, Carburant) so swapping in this component is a pure dedup:
 *   - Track: relative inline-flex h-6 w-11 rounded-full transition-colors ease-premium
 *   - On: `onColorClass` (e.g. bg-purple-600 / bg-brand-700 / bg-blue-600)
 *   - Off: bg-paper-300
 *   - Knob: inline-block h-4 w-4 bg-white rounded-full shadow
 *           translate-x-1 (off) → translate-x-6 (on), transition-transform ease-premium
 *   - Disabled: opacity-60 cursor-not-allowed
 *
 * The button carries role="switch" + aria-checked + the provided ariaLabel,
 * so it's correctly announced by assistive tech.
 */
export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  enabled,
  onChange,
  label,
  description,
  disabled,
  premium,
  ariaLabel,
  onColorClass = 'bg-brand-700',
}) => {
  const handleClick = () => {
    if (disabled) return;
    onChange(!enabled);
  };

  const premiumPill = premium ? (
    <span className="bg-accent-500/10 text-accent-700 text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
      Premium
    </span>
  ) : null;

  const toggleButton = (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={handleClick}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ease-premium ${
        enabled ? onColorClass : 'bg-paper-300'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ease-premium ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );

  // Compact form — just the pill + button. Used when the surrounding container
  // already provides the label/description (e.g. SettingsView section headers).
  if (!label) {
    if (!premiumPill) return toggleButton;
    return (
      <div className="flex items-center gap-2">
        {premiumPill}
        {toggleButton}
      </div>
    );
  }

  // Self-contained row form — label + description + premium pill on the left,
  // toggle on the right.
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-semibold text-paper-900 tracking-tight">
            {label}
          </span>
          {premiumPill}
        </div>
        {description && (
          <p className="text-xs text-paper-500 mt-0.5">{description}</p>
        )}
      </div>
      {toggleButton}
    </div>
  );
};

export default ToggleSwitch;
