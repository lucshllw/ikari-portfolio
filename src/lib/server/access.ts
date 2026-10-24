import { CLOUD_BUILD, isCloud } from './storage-mode';
export async function requireOwner(locals: App.Locals): Promise<{ id: string }> {
  if ((CLOUD_BUILD || isCloud())) return (await import('./cloud/auth')).requireCloudOwner(locals);
  return (await import('./auth')).requireOwner(locals);
}
