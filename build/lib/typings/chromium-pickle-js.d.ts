declare module 'chromium-pickle-js' {
	export interface Pickle {
		writeString(value: string): void;
		writeUInt32(value: number): void;

		toBuffer(): Buffer;
		createIterator(): {
			readUInt32(): number;
			readString(): string;
		};
	}

	export function createEmpty(): Pickle;
	export function createFromBuffer(buffer: Buffer): Pickle;
}
