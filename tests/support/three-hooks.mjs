import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../../vendor');
export async function resolve(specifier, context, next) {
  if (specifier === 'three') return {url: pathToFileURL(path.join(root, 'build/three.module.js')).href, shortCircuit: true};
  if (specifier.startsWith('three/addons/')) return {url: pathToFileURL(path.join(root, 'examples/jsm', specifier.slice(13))).href, shortCircuit: true};
  return next(specifier, context);
}
