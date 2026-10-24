<script lang="ts">
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/manrope';
import '../styles.css';
import IkariCursor from '$lib/components/IkariCursor.svelte';
export let data: { ikari: boolean };
</script>
<slot />

{#if data.ikari}<IkariCursor/>{/if}
