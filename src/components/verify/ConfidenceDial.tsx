import type { Verdict } from '@/lib/types';
import s from './verify.module.css';

const STROKE: Record<Verdict, string> = {
  Real: 'var(--verdict-real)',
  Fake: 'var(--verdict-fake)',
  Uncertain: 'var(--verdict-uncertain)',
};

const CAPTION: Record<Verdict, string> = {
  Real: 'confidence this claim is supported',
  Fake: 'confidence this claim is contradicted',
  Uncertain: 'confidence the evidence is genuinely inconclusive',
};

/**
 * Confidence in the verdict actually returned — never inverted.
 * The caption states what the number means so it cannot be misread.
 */
export function ConfidenceDial({ verdict, confidence }: { verdict: Verdict; confidence: number }) {
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, confidence));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className={s.dial}>
      <div className={s.dialWrap}>
        <svg className={s.dialSvg} viewBox="0 0 148 148" role="img" aria-label={`${clamped}% ${CAPTION[verdict]}`}>
          <circle className={s.dialTrack} cx="74" cy="74" r={radius} />
          <circle
            className={s.dialValue}
            cx="74"
            cy="74"
            r={radius}
            style={{
              stroke: STROKE[verdict],
              strokeDasharray: circumference,
              strokeDashoffset: offset,
            }}
          />
        </svg>
        <div className={s.dialText}>
          <span className={s.dialNumber}>{Math.round(clamped)}%</span>
        </div>
      </div>
      <p className={s.dialCaption}>{CAPTION[verdict]}</p>
    </div>
  );
}
