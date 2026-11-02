// Lets Node import the browser-only 'three' specifier from the vendored build (tests only): node --import ./tests/support/three-loader.mjs --test
import {register} from 'node:module';
import {pathToFileURL} from 'node:url';
register('./three-hooks.mjs', pathToFileURL(import.meta.filename));
