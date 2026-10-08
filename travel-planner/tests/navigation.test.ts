import { describe, expect, it } from "vitest";
import { nextRoutePath } from "../src/navigation";

const stale = {
  currentPath: "/travel-planner/trips/11111111-1111-4111-8111-111111111111/day/2030-01-07",
  tripId: "11111111-1111-4111-8111-111111111111",
  activeDay: "2030-01-05",
};

describe("deep-link routing during cloud cache refresh", () => {
  it("keeps an out-of-range deep link while the local cache is older than the server", () => {
    expect(nextRoutePath({ ...stale, remote: true, remoteReady: false, explicitSelection: false })).toBeNull();
  });

  it("updates the URL after the server confirms the trip range or the user navigates", () => {
    const expected = `/travel-planner/trips/${stale.tripId}/day/2030-01-05`;
    expect(nextRoutePath({ ...stale, remote: true, remoteReady: true, explicitSelection: false })).toBe(expected);
    expect(nextRoutePath({ ...stale, remote: true, remoteReady: false, explicitSelection: true })).toBe(expected);
  });

  it("updates local mode immediately and skips a no-op replacement", () => {
    const local = { ...stale, remote: false, remoteReady: true, explicitSelection: false };
    const next = `/travel-planner/trips/${stale.tripId}/day/2030-01-05`;
    expect(nextRoutePath(local)).toBe(next);
    expect(nextRoutePath({ ...local, currentPath: next })).toBeNull();
  });
});
