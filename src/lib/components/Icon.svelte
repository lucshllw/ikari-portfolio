<script lang="ts">
import {solarIcons} from './solar-icons';
export let name='arrow'; export let size=20;
</script>
<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">{@html solarIcons[name] || solarIcons.info}</svg>
