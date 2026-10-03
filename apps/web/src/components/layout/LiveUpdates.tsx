import { useQueryClient } from '@tanstack/react-query';
import { highlights } from '../../api/highlights';
import { applyLiveEvent, statusChangeMessage } from '../../api/liveUpdates';
import { useSSE } from '../../hooks/useSSE';
import { useToast } from '../ui/Toast';

/** Renders nothing; keeps cached data fresh from the server's event stream. */
export function LiveUpdates() {
  const qc = useQueryClient();
  const toast = useToast();
  useSSE((name, data) => {
    void applyLiveEvent(qc, name, data, {
      highlights,
      onStatusChange: (change) => toast({ ...statusChangeMessage(change), tone: 'info' }),
    });
  });
  return null;
}
