import type { Provider } from '@mrdash/shared';
import { GitBranch, GitFork } from 'lucide-react';

const LABELS: Record<Provider, string> = { GITHUB: 'GitHub', GITLAB: 'GitLab' };

export function ProviderIcon({ provider, size = 16 }: { provider: Provider; size?: number }) {
  const Icon = provider === 'GITHUB' ? GitBranch : GitFork;
  return (
    <Icon size={size} role="img" aria-label={LABELS[provider]} className="text-fg-secondary" />
  );
}
