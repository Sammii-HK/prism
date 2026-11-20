import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {components} from '../app/lib/registry.ts';
function keys(file,name){const tree=ts.createSourceFile(file,readFileSync(new URL('../'+file,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const found=[];function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(tree)===name&&node.initializer&&ts.isObjectLiteralExpression(node.initializer))for(const p of node.initializer.properties)if(ts.isPropertyAssignment(p))found.push(p.name.text??p.name.getText(tree));ts.forEachChild(node,visit);}visit(tree);return found;}
test('every component in the gallery has a registered card preview',()=>{const previews=new Set([...keys('app/lib/previews.tsx','previewMap'),...keys('app/lib/previews-lab.tsx','labPreviewMap')]);assert.deepEqual(components.filter(c=>!previews.has(c.slug)).map(c=>c.slug),[]);});
