import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {registry} from '../app/lib/registry.ts';
import {discoverComponents} from '../app/lib/discovery.ts';
const require=createRequire(import.meta.url);
const installable=new Set(require('../registry.config.json').items.map(item=>item.name));
test('installable results exactly match the shipped registry and never include studies',()=>{
 const found=discoverComponents(registry,'all','','installable',installable);
 assert.deepEqual(new Set(found.map(item=>item.slug)),installable);
 assert.ok(found.every(item=>item.type==='component'));
});
test('search, category and availability intersect without losing the chosen scope',()=>{
 const found=discoverComponents(registry,'overlay','dialog','installable',installable);
 assert.deepEqual(found.map(item=>item.slug).sort(),['dialog','sheet']);
 assert.ok(discoverComponents(registry,'all','','study',installable).every(item=>item.type==='study'));
 assert.equal(discoverComponents(registry,'all','nothing matches this','all',installable).length,0);
});
