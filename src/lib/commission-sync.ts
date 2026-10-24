const channelName = 'ikari-commissions';
export function announceCommissionChange() {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(channelName);
  channel.postMessage({ type: 'changed' });
  channel.close();
}
export { channelName };
