import type { AgentSessionEvent } from "@dotagame/contracts";
import { EventEmitter } from "node:events";

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

function eventName(rootSessionId: string): string {
  return `agent-session:${rootSessionId}`;
}

export function publishAgentSessionEvent(event: AgentSessionEvent): void {
  emitter.emit(eventName(event.rootSessionId), event);
}

export function subscribeAgentSessionEvents(
  rootSessionId: string,
  listener: (event: AgentSessionEvent) => void
): () => void {
  const name = eventName(rootSessionId);
  emitter.on(name, listener);
  return () => {
    emitter.off(name, listener);
  };
}
