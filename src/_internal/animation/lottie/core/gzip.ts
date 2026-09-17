const GZIP_MAGIC_0 = 0x1f;
const GZIP_MAGIC_1 = 0x8b;


export function isGzip(bytes: Uint8Array): boolean {
	return (
		bytes.length >= 2 && bytes[0] === GZIP_MAGIC_0 && bytes[1] === GZIP_MAGIC_1
	);
}


export async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
	if (typeof DecompressionStream === "undefined") {
		throw new Error(
			"lottie: gzip (.tgs) decompression requires DecompressionStream, which is unavailable in this environment",
		);
	}
	const stream = new Blob([bytes as BlobPart])
		.stream()
		.pipeThrough(new DecompressionStream("gzip"));
	const buffer = await new Response(stream).arrayBuffer();
	return new Uint8Array(buffer);
}


export async function decodeAnimationBytes(
	bytes: Uint8Array,
): Promise<Uint8Array> {
	return isGzip(bytes) ? gunzip(bytes) : bytes;
}
