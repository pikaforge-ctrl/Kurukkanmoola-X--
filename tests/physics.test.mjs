import test from 'node:test';
import assert from 'node:assert/strict';
import {circleBox,moveWithCollision,driveStep} from '../src/physics.js';
test('vehicle travel remains consistent across frame rates',()=>{
 function simulate(hz){const s={speed:0,steer:0,yaw:0,wheelbase:2.6};let z=0;for(let i=0;i<hz*5;i++)z+=driveStep(s,{forward:true},1/hz,28).dz;return z;}
 assert.ok(Math.abs(simulate(30)-simulate(144))<.5);
});
test('braking stops without oscillating into reverse',()=>{const s={speed:15,steer:0,yaw:0,wheelbase:2.6};for(let i=0;i<120;i++)driveStep(s,{brake:true},1/60,28);assert.equal(s.speed,0);});
test('substeps prevent tunnelling through narrow walls',()=>{const wall={minX:1,maxX:1.1,minZ:-2,maxZ:2};const p={x:0,z:0};assert.ok(moveWithCollision(p,10,0,(x,z)=>circleBox(x,z,.3,wall)));assert.ok(p.x<.71);});
test('movement can slide along walls',()=>{const wall={minX:1,maxX:2,minZ:-10,maxZ:10};const p={x:0,z:0};moveWithCollision(p,2,3,(x,z)=>circleBox(x,z,.3,wall));assert.ok(p.x<.71);assert.ok(p.z>2.9);});
test('reverse speed has a lower cap and steering reverses direction',()=>{const s={speed:-3,steer:0,yaw:0,wheelbase:2.6};for(let i=0;i<600;i++)driveStep(s,{backward:true,left:true},1/60,28);assert.ok(s.speed>=-8.4-.0001);assert.ok(s.yaw<0);});
