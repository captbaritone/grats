// https://twitter.com/edvinwennerdahl/status/1748436186840904103

/** @gqlType */
interface Cat {}

/** @gqlField */
export function catSound(obj: Cat): string {
  return "meow";
}
