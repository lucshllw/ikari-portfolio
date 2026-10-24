<script lang="ts">
import { onMount } from 'svelte';
export let covers:string[]=[];
onMount(()=>{
  const connection=(navigator as Navigator&{connection?:{saveData?:boolean}}).connection;
  if(connection?.saveData)return;
  let disposed=false,timer:ReturnType<typeof setTimeout>,idle=0;
  const retained:HTMLImageElement[]=[],queue=[...new Set(covers)].slice(0,23);
  const idleWindow=window as Window&{requestIdleCallback?:(callback:()=>void,options:{timeout:number})=>number;cancelIdleCallback?:(id:number)=>void};
  async function worker(){while(queue.length&&!disposed){const src=queue.shift()!;const img=new Image();img.decoding='async';img.fetchPriority='low';img.src=src;retained.push(img);try{await img.decode();}catch{}}}
  const start=()=>{if(!disposed){void worker();void worker();}};
  if(idleWindow.requestIdleCallback)idle=idleWindow.requestIdleCallback(start,{timeout:2500});else timer=setTimeout(start,800);
  return()=>{disposed=true;clearTimeout(timer);if(idle)idleWindow.cancelIdleCallback?.(idle);retained.length=0;};
});
</script>
