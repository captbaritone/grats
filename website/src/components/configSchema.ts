import ConfigSchema from "../../../grats-rs/crates/grats/grats-config-schema.json";

/**
 * Grats' options, read from the JSON Schema which `cargo test --test fixtures`
 * derives from the `GratsConfig` struct in grats-rs/. Only the subset of JSON
 * Schema which the options use is handled. Anything else throws, so that a new
 * kind of option fails the build until it's supported here.
 */

/** The JSON Schema itself, e.g. to validate the playground's tsconfig.json. */
export const GRATS_CONFIG_SCHEMA = ConfigSchema;

export type ConfigValue = string | boolean | null;

export type GratsConfig = Record<
  keyof typeof ConfigSchema.properties,
  ConfigValue
>;

export type ConfigOption = {
  name: string;
  paragraphs: string[];
  kind: "string" | "longString" | "boolean";
  nullable: boolean;
  default: ConfigValue;
  experimental: boolean;
};

export const CONFIG_OPTIONS: ConfigOption[] = Object.entries(
  ConfigSchema.properties,
).map(([name, property]: [string, any]) => ({
  name,
  // Paragraphs are separated by blank lines, and their lines are wrapped.
  paragraphs: property.description
    .split("\n\n")
    .map((paragraph: string) => paragraph.replace(/\n/g, " ")),
  ...optionType(name, property),
  default: property.default,
  experimental: property.experimental === true,
}));

function optionType(
  name: string,
  property: any,
): Pick<ConfigOption, "kind" | "nullable"> {
  const variants: any[] =
    property.anyOf ?? [property.type].flat().map((type: string) => ({ type }));
  const nullable = variants.some((variant) => variant.type === "null");
  const nonNull = variants.filter((variant) => variant.type !== "null");
  if (nonNull.length === 1) {
    const [variant] = nonNull;
    if (variant.$ref === "#/$defs/LongString") {
      return { kind: "longString", nullable };
    }
    if (variant.type === "string" || variant.type === "boolean") {
      return { kind: variant.type, nullable };
    }
  }
  throw new Error(
    `Unhandled type of the config option "${name}": ${JSON.stringify(
      property,
    )}`,
  );
}
