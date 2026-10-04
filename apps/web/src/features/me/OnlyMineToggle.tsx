import { User } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/cn';
import type { OnlyMine } from './useOnlyMine';
import { WhoAreYouDialog } from './WhoAreYouDialog';

export function OnlyMineToggle({ mine }: { mine: OnlyMine }) {
  return (
    <>
      <Button
        aria-pressed={mine.pressed}
        onClick={mine.toggle}
        className={cn(mine.pressed && 'border-accent text-accent')}
      >
        <User size={14} aria-hidden="true" /> Only mine
      </Button>
      <WhoAreYouDialog
        open={mine.picking}
        onOpenChange={mine.setPicking}
        users={mine.users}
        onPick={mine.pick}
      />
    </>
  );
}
