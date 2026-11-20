// Shared by the server pages and the client hub (a "use client" module's functions can't be called on the server).
export const HUB_VIEWS = ["discover", "mine", "requests", "inbox"] as const;
export type HubView = (typeof HUB_VIEWS)[number];
export const isHubView = (v: string | undefined): v is HubView => !!v && (HUB_VIEWS as readonly string[]).includes(v);
export const hubView = (v: string | undefined): HubView => (isHubView(v) ? v : "discover");
export const uuidOrNull = (v: string | undefined) => (v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null);
