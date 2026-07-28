'use client';

import s from './verify.module.css';

export type StageId = 'submit' | 'retrieve' | 'reason' | 'fuse';

export interface Stage {
  id: StageId;
  label: string;
  detail?: string;
}

export const STAGES: Stage[] = [
  { id: 'submit', label: 'Reading the claim' },
  { id: 'retrieve', label: 'Searching fact-checks and news archives' },
  { id: 'reason', label: 'Weighing the retrieved evidence' },
  { id: 'fuse', label: 'Producing the verdict' },
];

/**
 * Progress is driven by the real request lifecycle, not a timer.
 *
 * Audit fix: the previous loader animated on a fixed 450ms interval and called
 * its completion callback from inside a setState updater — it "finished"
 * whether or not any work had happened, and fired twice. This component simply
 * renders whichever stage the caller reports.
 */
export function VerificationProgress({ current }: { current: StageId }) {
  const currentIndex = STAGES.findIndex((stage) => stage.id === current);

  return (
    <div className={s.progress}>
      <div role="status" aria-live="polite" className="sr-only">
        {STAGES[currentIndex]?.label ?? 'Working'}
      </div>

      <ul className={s.stageList}>
        {STAGES.map((stage, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;

          return (
            <li
              key={stage.id}
              className={`${s.stage} ${done ? s.stageDone : ''} ${active ? s.stageActive : ''}`}
            >
              <span className={s.stageIcon} aria-hidden="true">
                {done ? '✓' : active ? '•' : ''}
              </span>
              <span>{stage.label}</span>
              {active && <span className={s.stageDetail}>working…</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
