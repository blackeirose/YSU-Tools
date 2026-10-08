type RouteInput = {
  currentPath: string;
  tripId: string | null;
  activeDay: string;
  remote: boolean;
  remoteReady: boolean;
  explicitSelection: boolean;
};

export function nextRoutePath({ currentPath, tripId, activeDay, remote, remoteReady,
  explicitSelection }: RouteInput): string | null {
  if (!tripId || !activeDay) return null;
  // A signed-in tab can render yesterday's IndexedDB snapshot before the
  // server confirms a newly extended trip. Keep the requested deep link until
  // that authoritative read arrives; a deliberate click can still navigate.
  if (remote && !remoteReady && !explicitSelection) return null;
  const next = `/travel-planner/trips/${tripId}/day/${activeDay}`;
  return currentPath === next ? null : next;
}
