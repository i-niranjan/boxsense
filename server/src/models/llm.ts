import type { MemoryObject } from '../types.js';

// Plain fetch calls. No LLM framework (Obsidian: "No LLM framework").
// Model is still open: Muse Spark if it takes images, otherwise Llama 4 vision on Fireworks.
// Never call these per frame.

/** Name a new object once, from its image crop. e.g. "small brown box, FRAGILE label". */
export async function nameObject(crop: Buffer, label: string): Promise<string> {
  void crop;
  void label;
  throw new Error('nameObject not implemented yet (server/src/models/llm.ts)');
}

/** Answer a question using the object memory as context. */
export async function ask(question: string, objects: MemoryObject[]): Promise<string> {
  void question;
  void objects;
  throw new Error('ask not implemented yet (server/src/models/llm.ts)');
}
