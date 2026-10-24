/** Explicit opt-in: a deployment must never silently fall back to an ephemeral DB. */
declare const __IKARI_CLOUD_BUILD__: boolean;
// A cloud build removes local adapters before deployment file tracing. Tests/CLI
// retain runtime selection; local preview and its SQLite installation stay intact.
export const CLOUD_BUILD = typeof __IKARI_CLOUD_BUILD__ !== 'undefined' && __IKARI_CLOUD_BUILD__;
export const isCloud = () => process.env.FRAME_STORAGE === 'supabase';
