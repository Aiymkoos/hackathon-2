import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHandTracker } from '../js/tracker.js';
import { HandLandmarker } from '../vendor/mediapipe/vision_bundle.mjs';
const nativeCreate = HandLandmarker.createFromOptions;
afterEach(()=>{HandLandmarker.createFromOptions=nativeCreate;delete globalThis.Worker;delete globalThis.createImageBitmap;});
const assets = { fileset: {}, model: new Uint8Array() };
class WorkerDouble {
  static all=[];
  constructor(){this.messages=[];WorkerDouble.all.push(this);}
  postMessage(data){this.messages.push(data);if(data.type==='init')queueMicrotask(()=>this.onmessage({data:{type:'ready'}}));}
  terminate(){this.terminated=true;}
  complete(time=100){this.onmessage({data:{type:'result',result:{landmarks:[]},time,inferenceMs:12}});}
}
function setup(){WorkerDouble.all=[];globalThis.Worker=WorkerDouble;globalThis.createImageBitmap=async()=>({close(){}});}
const flush=()=>new Promise(r=>setImmediate(r));
test('worker backpressure: at most one frame in flight and each result consumed once',async()=>{
  setup();const t=await createHandTracker(assets),w=WorkerDouble.all[0];
  const v={readyState:4,currentTime:1};assert.equal(t.detect(v,100),null);await flush();
  for(let i=1;i<10;i++){v.currentTime++;t.detect(v,100+i*40);}
  assert.equal(w.messages.filter(m=>m.type==='frame').length,1);
  w.complete(100);const result=t.detect(v,500);assert.equal(result.sampleId,100);
  assert.equal(t.detect(v,501),null);assert.equal(t.metrics.samples,1);t.close();assert.ok(w.terminated);
});
test('worker init failure uses a working compatibility detector',async()=>{
  globalThis.Worker=class {postMessage(){queueMicrotask(()=>this.onerror(new Error('Unsupported worker')));}terminate(){}};
  globalThis.createImageBitmap=async()=>({close(){}});
  let detections=0,closed=0;
  HandLandmarker.createFromOptions=async()=>({detectForVideo(){detections++;return {landmarks:[]};},close(){closed++;}});
  const t=await createHandTracker(assets);assert.equal(t.metrics.mode,'compatibility');
  const v={readyState:4,currentTime:1};assert.equal(t.detect(v,100).sampleId,100);assert.equal(t.detect(v,110),null);
  assert.equal(detections,1);t.close();assert.equal(closed,1);
});
test('runtime worker error recovers without accumulating frames',async()=>{
  setup();HandLandmarker.createFromOptions=async()=>({detectForVideo:()=>({landmarks:[]}),close(){}});
  const t=await createHandTracker(assets),w=WorkerDouble.all[0];
  w.onmessage({data:{type:'error',message:'lost GPU context'}});await flush();
  assert.ok(w.terminated);assert.equal(t.metrics.mode,'compatibility');
  assert.equal(t.detect({readyState:4,currentTime:1},100).sampleId,100);t.close();
});
test('frame created after shutdown is closed instead of posted to a dead worker',async()=>{
  setup();let resolveBitmap,closed=0;globalThis.createImageBitmap=()=>new Promise(r=>{resolveBitmap=r;});
  const t=await createHandTracker(assets),w=WorkerDouble.all[0];t.detect({readyState:4,currentTime:1},100);t.close();
  resolveBitmap({close(){closed++;}});await flush();assert.equal(closed,1);
  assert.equal(w.messages.filter(m=>m.type==='frame').length,0);
});
test('compatibility inference error is reported without crashing the render loop',async()=>{
  HandLandmarker.createFromOptions=async()=>({detectForVideo(){throw new Error('GPU reset');},close(){}});
  const t=await createHandTracker(assets);const r=t.detect({readyState:4,currentTime:1},100);
  assert.deepEqual(r.landmarks,[]);assert.match(t.metrics.error,/GPU reset/);t.close();
});
