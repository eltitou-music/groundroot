/**
 * Feature flags for the demo build.
 *
 * FLOW_V2 gates the calm linear S0→S5 "one breath" flow. When true, the
 * welcome screen routes straight into /set/$setId/dig and the multi-turn
 * coach thread + pillar shortcuts are demoted (kept in the codebase,
 * just unmounted). Flip to false to restore the original pillar UX.
 */
export const FLOW_V2 = true;
