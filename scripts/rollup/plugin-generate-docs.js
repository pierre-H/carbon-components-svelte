import fs from "fs";
import path from "path";
import { promisify } from "util";
import pkg from "../../package.json";
import { format } from "prettier";
import { parseComponent } from "./parse-component";
import { generateTypes } from "./generate-types";
import { generateIndex } from "./generate-index";
import { generatePublicAPI } from "./generate-public-api";

const writeFile = promisify(fs.writeFile);

/**
 * Rollup plugin to generate library TypeScript definitions and documentation.
 */
function pluginGenerateDocs() {
  const groups = new Map();
  const components = new Map();

  return {
    name: "generate-docs",
    async generateBundle(options, bundle) {
      for (const filename in bundle) {
        const chunkOrAsset = bundle[filename];

        if (chunkOrAsset.type !== "asset" && chunkOrAsset.isEntry) {
          chunkOrAsset.exports.forEach((exportee) => {
            components.set(exportee, {});
          });

          const shared_types = new Set();

          Object.keys(chunkOrAsset.modules)
            .sort()
            .forEach(async (filename) => {
              const { dir, ext, name } = path.parse(filename);
              const moduleName = name.replace(/\./g, "");

              if (ext === ".svelte" && components.has(moduleName)) {
                const group = dir.split("src/").pop().split("/")[0];

                if (groups.has(group)) {
                  groups.set(group, [...groups.get(group), moduleName]);
                } else {
                  groups.set(group, [moduleName]);
                }

                const typedefs = [];
                const source = fs.readFileSync(filename, "utf-8");
                const component = parseComponent(source, {
                  component: moduleName,
                  onTypeDef: (tag) => {
                    if (shared_types.has(tag.name)) return;
                    shared_types.add(tag.name);
                    typedefs.push(tag);
                  },
                });

                components.set(moduleName, { typedefs, component });
              }
            });
        }
      }
    },
    async writeBundle() {
      const { code: types } = generateTypes(components, pkg);
      await writeFile(pkg.types, format(types, { parser: "typescript" }));

      const { code: index } = generateIndex(components, groups, pkg);
      await writeFile(
        "./COMPONENT_INDEX.md",
        format(index, { parser: "markdown" })
      );

      const { code: json } = generatePublicAPI(components, groups, pkg);
      await writeFile(
        "./docs/src/PUBLIC_API.json",
        JSON.stringify(json, null, 2)
      );
    },
  };
}

export default pluginGenerateDocs;
