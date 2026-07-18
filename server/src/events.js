import { EventEmitter } from 'node:events';

/**
 * In-process event bus driving the SSE queue streams.
 * Single-node only — when scaling to multiple API nodes, replace the emitter
 * with Redis pub/sub (the cache client is already available via getCache()).
 */
export const bus = new EventEmitter();
bus.setMaxListeners(500); // one listener per open patient-board stream

export const emitQueueChange = dept => bus.emit('queue-changed', dept || null);
