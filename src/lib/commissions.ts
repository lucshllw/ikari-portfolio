/** Display convention for curated music commissions; custom CMS titles remain intact. */
export function releaseTitle(value:string){const split=value.lastIndexOf(' — ');return split>0?{track:value.slice(0,split),artist:value.slice(split+3)}:{track:value,artist:''};}
