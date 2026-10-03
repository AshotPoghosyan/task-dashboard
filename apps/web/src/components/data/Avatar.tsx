import { cn } from '../../lib/cn';

export interface Person {
  name: string;
  avatarUrl?: string | null;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

export function Avatar({ name, avatarUrl, size = 24 }: Person & { size?: number }) {
  return avatarUrl ? (
    <img
      src={avatarUrl}
      alt={name}
      title={name}
      width={size}
      height={size}
      className="rounded-full border border-border object-cover"
    />
  ) : (
    <span
      role="img"
      aria-label={name}
      title={name}
      style={{ width: size, height: size }}
      className="inline-flex items-center justify-center rounded-full border border-border bg-raised text-[10px] font-medium text-fg-secondary"
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ people, max = 3 }: { people: Person[]; max?: number }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className={cn('flex items-center')}>
      {shown.map((p, i) => (
        <span key={`${p.name}-${i}`} className="-ml-1.5 first:ml-0">
          <Avatar {...p} />
        </span>
      ))}
      {extra > 0 ? <span className="tabular ml-1 text-xs text-fg-secondary">+{extra}</span> : null}
    </div>
  );
}
