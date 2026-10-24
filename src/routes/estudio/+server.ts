import {redirect} from '@sveltejs/kit';
// Reuse the existing protected studio and its local/cloud authentication.
export const GET=()=>redirect(303,'/admin/pedidos');
