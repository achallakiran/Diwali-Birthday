import test from 'node:test';
import assert from 'node:assert/strict';
import {findPath,walkable,clearSegment} from './navigation.js';
test('walking to the opposite side routes around the cake table',()=>{
  const start=[-3.7,1.8],goal=[3.7,1.8],path=findPath(start,goal,.5);
  assert.ok(path&&path.length>1);let previous=start;
  for(const waypoint of path){assert.ok(walkable(...waypoint,.5));assert.ok(clearSegment(previous,waypoint,.5));previous=waypoint;}
  assert.deepEqual(path.at(-1),goal);
});
test('a clear floor target can be approached directly',()=>assert.deepEqual(findPath([-3.7,0],[-3.7,3.5]),[[-3.7,3.5]]));
test('table and outside-room targets are rejected',()=>{assert.equal(findPath([-3.7,0],[0,1.7]),null);assert.equal(findPath([-3.7,0],[20,0]),null);});
