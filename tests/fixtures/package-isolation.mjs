import { realpathSync } from "node:fs";
import { sep } from "node:path";
import { fileURLToPath } from "node:url";

let boundary;
export function initialize(data) {
  boundary = data;
}

export async function resolve(specifier, context, nextResolve) {
  const result = await nextResolve(specifier, context);
  if (result.url.startsWith("file:")) {
    const actual = realpathSync(fileURLToPath(result.url));
    if (
      actual !== boundary.bootstrap &&
      !actual.startsWith(boundary.root + sep)
    )
      throw new Error("Dependency escaped isolated package installation");
  }
  return result;
}
