import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";
import vm from "node:vm";
import ts from "typescript";
import * as THREE from "three";

export const root=fileURLToPath(new URL("../",import.meta.url)), require=createRequire(import.meta.url);
const modules=new Map();
export function load(file) {
  if (modules.has(file)) return modules.get(file);
  if (file.endsWith(".json")) return JSON.parse(fs.readFileSync(file,"utf8"));
  const module={exports:{}};
  const source=fs.readFileSync(file+".ts","utf8");
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInThisContext("(function(module,exports,require){"+js+"\n})",{filename:file})(module,module.exports,id=>{
    if(id.startsWith("@/")) return load(path.join(root,"src",id.slice(2)));
    if(id.startsWith(".")) return load(path.resolve(path.dirname(file),id));
    return id==="three" ? THREE : require(id);
  });
  modules.set(file,module.exports);
  return module.exports;
}
