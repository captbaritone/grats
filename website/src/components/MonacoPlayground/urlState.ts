import { SerializableState } from "./State";
import lzstring from "lz-string";

export function serializeState(serializableState: SerializableState): string {
  const hash = lzstring.compressToEncodedURIComponent(
    JSON.stringify(serializableState),
  );
  return hash;
}
