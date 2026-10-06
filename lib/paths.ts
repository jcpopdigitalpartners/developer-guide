export const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '');
/** Prefix public assets and plain anchors with the build-time Pages mount path. */
export function sitePath(path: string) { return `${basePath}/${path.replace(/^\/+/, '')}`; }
