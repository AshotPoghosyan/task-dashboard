import { EventEmitter } from 'node:events';

export interface AppEvents {
  'mr.updated': { id: string; repositoryId: string };
  'task.updated': { id: string };
  'sync.finished': { repositoryId: string; status: 'SUCCESS' | 'FAILED' };
}

/** In-process typed event bus; the SSE stream (Phase 6) subscribes to it. */
class TypedBus {
  private readonly emitter = new EventEmitter();

  emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): void {
    this.emitter.emit(event, payload);
  }

  on<K extends keyof AppEvents>(event: K, listener: (payload: AppEvents[K]) => void): () => void {
    this.emitter.on(event, listener);
    return () => this.emitter.off(event, listener);
  }
}

export const eventBus = new TypedBus();
export type EventBus = TypedBus;
