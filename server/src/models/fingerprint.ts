/**
 * DINOv2 visual fingerprint for an object crop, used by memory mode 'full'.
 *
 * TODO(Nov 1): `npm i @huggingface/transformers sharp -w server`, then crop with sharp and
 * run a DINOv2-small feature-extraction pipeline in Node. Return a normalised vector.
 */
export async function fingerprint(crop: Buffer): Promise<number[] | undefined> {
  void crop;
  return undefined;
}
