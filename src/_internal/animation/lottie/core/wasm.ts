





export interface LottieWasmExports {
	memory: WebAssembly.Memory;
	tlottie_alloc(len: number): number;
	tlottie_free(ptr: number, len: number): void;
	tlottie_new(jsonPtr: number, jsonLen: number): number;
	tlottie_new_with_options(
		jsonPtr: number,
		jsonLen: number,
		fitzModifier: number,
		replacementsPtr: number,
		replacementsLen: number,
	): number;
	tlottie_drop(inst: number): void;
	tlottie_width(inst: number): number;
	tlottie_height(inst: number): number;
	tlottie_frame_rate(inst: number): number;
	tlottie_frame_count(inst: number): number;
	tlottie_render(
		inst: number,
		frame: number,
		width: number,
		height: number,
		antialias: number,
	): number;
	tlottie_render_with_options(
		inst: number,
		frame: number,
		width: number,
		height: number,
		antialias: number,
		curveTolerance: number,
	): number;
	tlottie_render_alpha8(
		inst: number,
		frame: number,
		width: number,
		height: number,
		antialias: number,
	): number;
	tlottie_render_alpha8_with_options(
		inst: number,
		frame: number,
		width: number,
		height: number,
		antialias: number,
		curveTolerance: number,
	): number;
	tlottie_render_alpha8_color(
		inst: number,
		frame: number,
		width: number,
		height: number,
		antialias: number,
		color: number,
	): number;
	tlottie_render_alpha8_color_with_options(
		inst: number,
		frame: number,
		width: number,
		height: number,
		antialias: number,
		color: number,
		curveTolerance: number,
	): number;
}





let modulePromise: Promise<LottieWasmExports> | null = null;

export function loadWasmModule(
	wasmUrl: string | URL,
): Promise<LottieWasmExports> {
	if (!modulePromise) {
		modulePromise = instantiate(wasmUrl);
	}
	return modulePromise;
}

async function instantiate(wasmUrl: string | URL): Promise<LottieWasmExports> {
	
	
	
	if (typeof WebAssembly.instantiateStreaming === "function") {
		try {
			const { instance } = await WebAssembly.instantiateStreaming(
				fetch(wasmUrl, { cache: "force-cache" }),
				{},
			);
			return instance.exports as unknown as LottieWasmExports;
		} catch {
			
			
			
		}
	}
	const bytes = await (
		await fetch(wasmUrl, { cache: "force-cache" })
	).arrayBuffer();
	const { instance } = await WebAssembly.instantiate(bytes, {});
	return instance.exports as unknown as LottieWasmExports;
}
