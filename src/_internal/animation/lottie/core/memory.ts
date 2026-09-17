import type { LottieWasmExports } from "./wasm";

export interface WasmAlloc {
	ptr: number;
	len: number;
}










export function writeBytes(
	exports: LottieWasmExports,
	bytes: Uint8Array,
): WasmAlloc | null {
	const len = bytes.length;
	if (len === 0) return null;
	const ptr = exports.tlottie_alloc(len);
	if (ptr === 0) return null;
	new Uint8Array(exports.memory.buffer, ptr, len).set(bytes);
	return { ptr, len };
}

export function freeBytes(exports: LottieWasmExports, alloc: WasmAlloc): void {
	if (alloc.ptr !== 0) exports.tlottie_free(alloc.ptr, alloc.len);
}


export function readRgba(
	exports: LottieWasmExports,
	ptr: number,
	width: number,
	height: number,
): Uint8ClampedArray<ArrayBuffer> {
	return new Uint8ClampedArray(exports.memory.buffer, ptr, width * height * 4);
}


export function readAlpha8(
	exports: LottieWasmExports,
	ptr: number,
	width: number,
	height: number,
): Uint8Array<ArrayBuffer> {
	return new Uint8Array(exports.memory.buffer, ptr, width * height);
}
