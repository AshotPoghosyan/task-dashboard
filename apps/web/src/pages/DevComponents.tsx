import { TASK_STATUSES } from '@mrdash/shared';
import { Inbox } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Avatar, AvatarStack } from '../components/data/Avatar';
import { FilterBar, type FilterChip } from '../components/data/FilterBar';
import { ProviderIcon } from '../components/data/ProviderIcon';
import { StatCard } from '../components/data/StatCard';
import { StatusBadge } from '../components/data/StatusBadge';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from '../components/ui/Dialog';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { MultiSelect } from '../components/ui/MultiSelect';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/Popover';
import { Select } from '../components/ui/Select';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { Tooltip } from '../components/ui/Tooltip';

const OPTIONS = [
  { value: 'main', label: 'main' },
  { value: 'develop', label: 'develop' },
  { value: 'release', label: 'release' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-fg-secondary">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

/** Dev-only gallery of every component in every state (`/dev/components`). */
export default function DevComponents() {
  const toast = useToast();
  const [multi, setMulti] = useState<string[]>(['main']);
  const [single, setSingle] = useState('main');
  const [chips, setChips] = useState<FilterChip[]>([
    { key: 'status', label: 'Status', value: 'Open' },
    { key: 'branch', label: 'Branch', value: 'main' },
  ]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Components</h1>
      <Section title="Button">
        <Button variant="primary">Primary</Button>
        <Button>Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button disabled>Disabled</Button>
        <Button size="sm">Small</Button>
      </Section>
      <Section title="Badge">
        <Badge>Default</Badge>
        <Badge>12</Badge>
      </Section>
      <Section title="StatusBadge">
        {TASK_STATUSES.map((s) => (
          <StatusBadge key={s} status={s} />
        ))}
      </Section>
      <Section title="Card / StatCard">
        <Card>Plain card</Card>
        <StatCard label="Open MRs" value={42} secondary="3 more than yesterday" />
        <StatCard label="Loading" loading />
        <StatCard label="Clickable" value={7} onClick={() => undefined} />
        <StatCard label="Active" value={7} onClick={() => undefined} active />
      </Section>
      <Section title="Input">
        <Input aria-label="Default input" placeholder="Default" className="w-48" />
        <Input aria-label="Disabled input" placeholder="Disabled" disabled className="w-48" />
        <Input aria-label="Invalid input" aria-invalid defaultValue="Invalid" className="w-48" />
      </Section>
      <Section title="Select / MultiSelect">
        <Select
          aria-label="Target branch"
          value={single}
          onValueChange={setSingle}
          options={OPTIONS}
        />
        <MultiSelect label="Branches" options={OPTIONS} value={multi} onChange={setMulti} />
        <MultiSelect label="Empty" options={[]} value={[]} onChange={() => undefined} />
      </Section>
      <Section title="Tooltip / Popover">
        <Tooltip content="Helpful hint">
          <Button>Hover me</Button>
        </Tooltip>
        <Popover>
          <PopoverTrigger asChild>
            <Button>Open popover</Button>
          </PopoverTrigger>
          <PopoverContent>Popover content</PopoverContent>
        </Popover>
      </Section>
      <Section title="Dialog / Drawer / Toast">
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open dialog</Button>
          </DialogTrigger>
          <DialogContent title="Dialog" description="A modal dialog.">
            Body
          </DialogContent>
        </Dialog>
        <Drawer>
          <DrawerTrigger asChild>
            <Button>Open drawer</Button>
          </DrawerTrigger>
          <DrawerContent title="Drawer">Body</DrawerContent>
        </Drawer>
        <Button onClick={() => toast({ title: 'Saved', tone: 'success' })}>Success toast</Button>
        <Button onClick={() => toast({ title: 'Failed', description: 'Try again', tone: 'error' })}>
          Error toast
        </Button>
      </Section>
      <Section title="Skeleton / EmptyState">
        <Skeleton className="h-6 w-40" />
        <EmptyState
          icon={<Inbox size={24} />}
          title="No merge requests match these filters"
          description="Try removing a filter."
          action={<Button>Clear filters</Button>}
        />
      </Section>
      <Section title="ProviderIcon / Avatar">
        <ProviderIcon provider="GITHUB" />
        <ProviderIcon provider="GITLAB" />
        <Avatar name="Ada Lovelace" />
        <AvatarStack
          people={[
            { name: 'Ada Lovelace' },
            { name: 'Alan Turing' },
            { name: 'Grace Hopper' },
            { name: 'Linus T' },
          ]}
        />
      </Section>
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-fg-secondary">FilterBar</h2>
        <FilterBar
          chips={chips}
          onRemove={(c) => setChips((p) => p.filter((x) => x !== c))}
          onClearAll={() => setChips([])}
        >
          <Input aria-label="Filter search" placeholder="Search" className="w-48" />
        </FilterBar>
      </section>
    </div>
  );
}
