import { test } from 'node:test';
import assert from 'node:assert/strict';
const { AudioController } = await import(process.env.PLAYER_TEST_MODULE);
class Media {
  src=''; currentSrc=''; readyState=0; duration=120; paused=true; seeking=false; playbackRate=1; error=null; ended=false;
  time=0; loads=0; plays=0; listeners=new Map();
  get currentTime(){return this.time;}
  set currentTime(time){this.time=time;this.seeking=true;}
  addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);}
  removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);}
  emit(name){for(const fn of this.listeners.get(name)||[])fn({type:name});}
  load(){this.loads++;this.readyState=0;this.currentSrc='';this.time=0;this.seeking=false;this.paused=true;this.emit('timeupdate');}
  loadReady(src=this.src){this.currentSrc=src;this.readyState=1;this.emit('loadedmetadata');}
  seekReady(time=this.time){this.time=time;this.seeking=false;this.emit('timeupdate');this.emit('seeked');}
  progress(time){this.time=time;this.emit('timeupdate');}
  play(){this.plays++;this.paused=false;this.emit('play');return Promise.resolve();}
  pause(){const changed=!this.paused;this.paused=true;if(changed)this.emit('pause');}
}
function setup(positions={},autoNext=false){
 const media=new Media();const snapshots=[];const errors=[];const ended=[];
 const player=new AudioController(media,[{src:'/audio/01.mp3',duration:120},{src:'/audio/02.mp3',duration:120},{src:'/audio/03.mp3',duration:120}],positions,'https://lesson.test/',{onUpdate:s=>snapshots.push(s),onError:e=>errors.push(e),onEnded:i=>{ended.push(i);if(autoNext&&i<2)player.select(i+1,{autoplay:true,seconds:0});},requestFrame:()=>1,cancelFrame:()=>{}});
 return {media,player,positions,errors,ended,get state(){return snapshots.at(-1);}};
}
test('a waveform seek before metadata survives loading reset events',()=>{
 const x=setup();x.player.select(0);x.player.seek(43.2);x.media.progress(0);
 assert.equal(x.state.time,43.2);x.media.loadReady();assert.equal(x.media.currentTime,43.2);
 x.media.progress(0);assert.equal(x.state.time,43.2);x.media.seekReady(43.2);assert.equal(x.state.time,43.2);assert.equal(x.positions['0'],43.2);
});
test('later metadata and canplay events never rewind a completed seek',()=>{
 const x=setup();x.player.select(0);x.media.loadReady();x.player.seek(58);x.media.seekReady();x.media.emit('loadedmetadata');x.media.emit('canplay');assert.equal(x.media.currentTime,58);assert.equal(x.state.time,58);assert.equal(x.media.loads,1);
});
test('switching away and returning restores each chapter while playing',()=>{
 const x=setup();x.player.select(0);x.media.loadReady();x.player.play();x.media.progress(37);
 x.player.select(1);x.media.loadReady();x.media.progress(21);
 x.player.select(0);assert.equal(x.state.time,37);x.media.progress(0);assert.equal(x.state.time,37);
 x.media.loadReady();assert.equal(x.media.currentTime,37);x.media.seekReady();assert.equal(x.state.playing,true);assert.equal(x.positions['1'],21);
});
test('paused switching restores the chapter without starting playback',()=>{
 const x=setup({'1':66});x.player.select(0);x.media.loadReady();x.player.select(1);x.media.loadReady();x.media.seekReady();assert.equal(x.state.time,66);assert.equal(x.state.playing,false);assert.equal(x.media.plays,0);
});
test('rapid chapter changes ignore stale metadata from the old source',()=>{
 const x=setup({'1':35,'2':74});x.player.select(0);x.media.loadReady();const old=x.media.src;
 x.player.select(1);x.player.select(2);x.media.loadReady(old);assert.equal(x.state.index,2);assert.equal(x.state.time,74);
 x.media.loadReady();x.media.seekReady();assert.equal(x.state.time,74);assert.equal(x.positions['1'],35);
});
test('rapid drag seeks retain the most recent target, not a stale seek result',()=>{
 const x=setup();x.player.select(0);x.media.loadReady();x.player.seek(13);x.player.seek(44.8);x.media.seekReady(13);assert.equal(x.state.time,44.8);x.media.seekReady(44.8);assert.equal(x.state.time,44.8);
});
test('selecting the current chapter does not reload or restart it',()=>{
 const x=setup();x.player.select(0);x.media.loadReady();x.media.progress(49);x.player.select(0);assert.equal(x.media.loads,1);assert.equal(x.state.time,49);
});
test('seek during playback preserves playback and does not reload the recording',()=>{
 const x=setup();x.player.select(0);x.media.loadReady();x.player.play();x.player.seek(90);x.media.seekReady();assert.equal(x.state.time,90);assert.equal(x.state.playing,true);assert.equal(x.media.loads,1);
});
test('restoring a session loads its selected chapter directly at the saved position',()=>{
 const x=setup({'2':63});x.player.select(2);assert.equal(x.media.src,'https://lesson.test/audio/03.mp3');x.media.loadReady();x.media.seekReady();assert.equal(x.state.time,63);assert.equal(x.media.loads,1);
});
test('retry retains the requested playback point',()=>{
 const x=setup();x.player.select(0);x.media.loadReady();x.player.seek(81);x.media.seekReady();x.player.retry();x.media.loadReady();x.media.seekReady();assert.equal(x.state.time,81);
});
test('revisited completed chapters are not silently reset to zero',()=>{
 const x=setup({'1':120});x.player.select(1);x.media.loadReady();x.media.seekReady();assert.equal(x.state.time,120);
});
test('explicit auto-next starts the next chapter from its own beginning',()=>{
 const x=setup({'1':44});x.player.select(0);x.media.loadReady();x.player.select(1,{autoplay:true,seconds:0});x.media.loadReady();assert.equal(x.state.index,1);assert.equal(x.state.time,0);assert.equal(x.media.currentTime,0);assert.equal(x.state.playing,true);
});
test('download progress retries a seek that the media element initially rejects',()=>{
 const x=setup();x.player.select(0);x.media.loadReady();x.player.seek(72);x.media.seekReady(0);assert.equal(x.state.time,72);x.media.emit('progress');assert.equal(x.media.currentTime,72);x.media.seekReady();assert.equal(x.state.time,72);
});
test('pausing during loading cancels queued autoplay without losing the seek target',()=>{
 const x=setup({'1':55});x.player.select(1,{autoplay:true});x.player.pause();x.media.loadReady();x.media.seekReady();assert.equal(x.state.time,55);assert.equal(x.media.plays,0);
});
test('choosing the waveform while paused requests play immediately at the chosen time',()=>{
 const x=setup();x.player.select(0);x.media.loadReady();
 x.player.seekAndPlay(46.5);
 assert.equal(x.media.currentTime,46.5);assert.equal(x.media.plays,1);assert.equal(x.state.playing,true);
 x.media.seekReady();assert.equal(x.state.time,46.5);assert.equal(x.media.loads,1);
});
test('a waveform gesture requests play before metadata without losing the selected time',()=>{
 const x=setup();x.player.select(0);x.player.seekAndPlay(71);
 assert.equal(x.media.plays,1);assert.equal(x.state.time,71);
 x.media.loadReady();assert.equal(x.media.currentTime,71);x.media.seekReady();x.media.emit('playing');assert.equal(x.state.time,71);assert.equal(x.state.playing,true);
});
test('clicking the current waveform position resumes a paused recording',()=>{
 const x=setup();x.player.select(0);x.media.loadReady();x.media.progress(29);
 x.player.seekAndPlay(29);assert.equal(x.media.plays,1);assert.equal(x.state.time,29);assert.equal(x.state.playing,true);
});
test('dragging across the waveform keeps playing and commits the latest point',()=>{
 const x=setup();x.player.select(0);x.media.loadReady();
 x.player.seekAndPlay(10);x.player.seekAndPlay(40);x.player.seekAndPlay(88.2);
 x.media.seekReady(40);assert.equal(x.state.time,88.2);x.media.seekReady(88.2);
 assert.equal(x.state.time,88.2);assert.equal(x.state.playing,true);assert.equal(x.media.plays,1);assert.equal(x.media.loads,1);
});
test('the section snapshot follows actual chapter endings and next-source playback',()=>{
 const x=setup({},true);x.player.select(0);x.media.loadReady();x.player.play();x.media.progress(120);
 x.media.paused=true;x.media.emit('ended');
 assert.deepEqual(x.ended,[0]);assert.equal(x.state.index,1);assert.equal(x.state.time,0);assert.equal(x.state.loading,true);assert.equal(x.state.playing,false);
 assert.equal(x.media.src,'https://lesson.test/audio/02.mp3');
 x.media.loadReady();x.media.progress(19);
 assert.equal(x.state.index,1);assert.equal(x.state.time,19);assert.equal(x.state.playing,true);
 x.media.progress(120);x.media.paused=true;x.media.emit('ended');x.media.loadReady();
 assert.equal(x.state.index,2);assert.equal(x.media.src,'https://lesson.test/audio/03.mp3');assert.equal(x.state.playing,true);
});
test('seeking and pausing update the section clock without changing its chapter',async()=>{
 const x=setup();x.player.select(1);x.media.loadReady();x.player.seekAndPlay(87);x.media.seekReady();
 assert.equal(x.state.index,1);assert.equal(x.state.time,87);assert.equal(x.state.playing,true);
 await new Promise(resolve=>setImmediate(resolve));
 x.player.pause();assert.equal(x.state.index,1);assert.equal(x.state.time,87);assert.equal(x.state.playing,false);
 x.player.seekAndPlay(12);x.media.seekReady();assert.equal(x.state.index,1);assert.equal(x.state.time,12);assert.equal(x.state.playing,true);
});
