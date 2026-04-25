export function KakaoIcon({
  size = 20,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.79 1.86 5.23 4.66 6.66l-1.16 4.27c-.1.36.3.65.62.45L11.2 19c.27.02.53.04.8.04 5.523 0 10-3.477 10-7.8S17.523 3 12 3z" />
    </svg>
  );
}
