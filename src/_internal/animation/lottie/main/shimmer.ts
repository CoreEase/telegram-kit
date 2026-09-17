export interface ShimmerMaskStyle {
	maskImage: string;
	WebkitMaskImage: string;
}

export function buildShimmerMaskStyle(outlineSvg: string): ShimmerMaskStyle {
	const dataUri = `url("data:image/svg+xml;base64,${svgToBase64(outlineSvg)}")`;
	return { maskImage: dataUri, WebkitMaskImage: dataUri };
}

function svgToBase64(svg: string): string {
	const bytes = new TextEncoder().encode(svg);
	let binary = "";
	for (let i = 0; i < bytes.length; i++)
		binary += String.fromCharCode(bytes[i]);
	return btoa(binary);
}
