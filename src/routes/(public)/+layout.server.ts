import { getPublicSettings, getPublicProjects } from '$lib/server/catalog';
export const load=async()=>{const ikari=process.env.FRAME_THEME==='ikari';const projects=ikari?await getPublicProjects():[];return{settings:await getPublicSettings(),publicCount:projects.length,covers:projects.map(project=>project.coverUrl),presentation:{theme:ikari?'ikari':'frame'}};};
