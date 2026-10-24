<script lang="ts">
  import type { PageData } from './$types';
  import IkariAbout from '$lib/components/IkariAbout.svelte';
  import IkariBehindScenes from '$lib/components/IkariBehindScenes.svelte';
  export let data: PageData;
</script>

<svelte:head><title>Sobre — {data.settings.brandName}</title></svelte:head>
{#if data.presentation.theme === 'ikari'}
  <div class="about-page"><IkariAbout about={data.settings.about} expanded/><IkariBehindScenes/></div>
{:else}
  <div class="v04-wrap"><header class="v04-page-heading"><h1>Sobre {data.settings.brandName}</h1></header><p class="frame-about">{data.settings.about}</p></div>
{/if}

<style>.about-page{padding-block:35px 65px}.frame-about{max-width:65ch;font-size:16px;line-height:1.8;white-space:pre-line;padding-bottom:65px}@media(max-width:760px){.about-page{padding-top:25px;padding-bottom:40px}}</style>
