import { useState } from 'react';
import { avatarColorIndex, initials } from '../../lib/avatar';
import { cn } from '../../lib/cn';

export interface Person {
  name: string;
  avatarUrl?: string | null;
}

/** Static class names so Tailwind can see them. */
const COLORS = [
  'bg-avatar-0',
  'bg-avatar-1',
  'bg-avatar-2',
  'bg-avatar-3',
  'bg-avatar-4',
  'bg-avatar-5',
];

/**
 * The person's picture, or their initials on a colored circle when there is no URL or the
 * image fails to load or is blocked. The wrapper carries the accessible name; the inner image
 * has an empty alt, so a broken image never shows alt text.
 */
export function Avatar({ name, avatarUrl, size = 24 }: Person & { size?: number }) {
  // Remember which URL failed, so a new URL gets a fresh attempt without any effect.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const showImage = avatarUrl && failedUrl !== avatarUrl;
  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.42)) }}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-medium text-avatar-fg',
        showImage ? 'border border-border' : COLORS[avatarColorIndex(name)],
      )}
    >
      {showImage ? (
        <img
          src={avatarUrl}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(avatarUrl)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
    </span>
  );
}

export function AvatarStack({ people, max = 3 }: { people: Person[]; max?: number }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <span key={`${p.name}-${i}`} className="-ml-1.5 first:ml-0">
          <Avatar {...p} />
        </span>
      ))}
      {extra > 0 ? <span className="tabular ml-1 text-xs text-fg-secondary">+{extra}</span> : null}
    </div>
  );
}
