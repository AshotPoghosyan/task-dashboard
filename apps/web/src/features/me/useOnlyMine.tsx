import type { GitUser } from '@mrdash/shared';
import { useEffect, useState } from 'react';
import { useUrlParam } from '../../hooks/useUrlParam';
import { useMe } from './useMe';

/**
 * "Only mine" toggle state, kept in the URL (`?mine=1`). When the user is not known yet
 * (password mode), switching it on first asks "Who are you?".
 */
export function useOnlyMine() {
  const state = useMe();
  const { me, ready, setMeId } = state;
  const [param, setParam] = useUrlParam('mine');
  const [picking, setPicking] = useState(false);
  const wanted = param === '1';

  // A shared link with ?mine=1 opens the picker once, if we cannot tell who "mine" is.
  useEffect(() => {
    if (wanted && ready && !me) setPicking(true);
  }, [wanted, ready, me]);

  const toggle = () => {
    if (wanted) setParam(null);
    else if (me) setParam('1');
    else setPicking(true);
  };

  const pick = (user: GitUser) => {
    setMeId(user.id);
    setParam('1');
    setPicking(false);
  };

  return {
    ...state,
    /** The switch is on and we know who "mine" refers to. */
    active: wanted && !!me,
    pressed: wanted,
    toggle,
    picking,
    setPicking,
    pick,
  };
}

export type OnlyMine = ReturnType<typeof useOnlyMine>;
