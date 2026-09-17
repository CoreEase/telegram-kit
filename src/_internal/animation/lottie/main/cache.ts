
const cache = new Map<string, Promise<Uint8Array>>();

export function fetchAnimationBytes(src: string): Promise<Uint8Array> {
	let pending = cache.get(src);
	if (!pending) {
		pending = fetch(src, { cache: "force-cache" })
			.then((res) => {
				if (!res.ok)
					throw new Error(`lottie: fetch failed for "${src}" (${res.status})`);
				return res.arrayBuffer();
			})
			.then((buffer) => new Uint8Array(buffer));

		pending.catch(() => cache.delete(src));
		cache.set(src, pending);
	}
	return pending;
}

export function isAnimationCached(src: string): boolean {
	return cache.has(src);
}
