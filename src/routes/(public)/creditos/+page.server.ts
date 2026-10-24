import {redirect} from '@sveltejs/kit';
export const load=()=>{if(process.env.FRAME_THEME==='ikari')redirect(307,'/links#materiais');return {};};
