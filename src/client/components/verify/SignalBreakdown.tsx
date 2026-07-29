import type { SignalContribution } from '@/shared/types';
import s from './verify.module.css';

/**
 * Explainability, PRD §7: every verdict must show why. Each signal is drawn on
 * a bipolar scale so the reader can see which way it pushed and how hard.
 */
export function SignalBreakdown({ signals }: { signals: SignalContribution[] }) {
  const totalWeight = signals.reduce((sum, sig) => sum + sig.weight, 0) || 1;

  return (
    <div className={s.signalList}>
      {signals.map((signal) => {
        const pct = Math.abs(signal.score) * 50; // half-width of the bipolar bar
        const positive = signal.score >= 0;
        const share = Math.round((signal.weight / totalWeight) * 100);

        return (
          <div key={signal.label} className={s.signal}>
            <div className={s.signalHead}>
              <span className={s.signalName}>{signal.label}</span>
              <span className={s.signalWeight}>{share}% of decision</span>
            </div>

            <div
              className={s.scale}
              role="meter"
              aria-label={`${signal.label}: ${signal.score >= 0 ? 'supports' : 'contradicts'} the claim`}
              aria-valuenow={Math.round(signal.score * 100)}
              aria-valuemin={-100}
              aria-valuemax={100}
            >
              <span className={s.scaleCentre} aria-hidden="true" />
              <span
                className={s.scaleFill}
                style={{
                  left: positive ? '50%' : `${50 - pct}%`,
                  width: `${pct}%`,
                  background: positive ? 'var(--verdict-real)' : 'var(--verdict-fake)',
                }}
              />
            </div>

            <div className={s.scaleLegend} aria-hidden="true">
              <span>contradicts</span>
              <span>supports</span>
            </div>

            <p className={s.signalDetail}>{signal.detail}</p>
          </div>
        );
      })}
    </div>
  );
}
