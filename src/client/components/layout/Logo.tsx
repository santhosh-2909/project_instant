export function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
      {/* Shield — trust, protection */}
      <path
        d="M16 2.5 5.5 6.8v8.4c0 6.6 4.3 12.1 10.5 14.3 6.2-2.2 10.5-7.7 10.5-14.3V6.8L16 2.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Check — verification */}
      <path
        d="m11.2 16.1 3.3 3.4 6.3-6.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
