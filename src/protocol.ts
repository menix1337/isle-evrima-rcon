/**
 * @fileoverview Low-level protocol handling for Isle Evrima RCON communication.
 * @module isle-evrima-rcon/protocol
 */

import { Socket } from 'node:net';
import { RCONError, RCONErrorCode, type ConnectionState } from './types.js';
import { getCommandCode } from './commands.js';
import type { Command } from './types.js';

/**
 * Protocol constants.
 */
export const Protocol = {
	/** Command packet prefix */
	COMMAND_PREFIX: 0x02,
	/** Auth packet prefix */
	AUTH_PREFIX: 0x01,
	/** Packet terminator */
	TERMINATOR: 0x00,
	/** Default encoding for all packets - latin1 supports full 0-255 byte range */
	ENCODING: 'latin1' as BufferEncoding,
	/** Success message for authentication */
	AUTH_SUCCESS: 'Password Accepted',
} as const;

/**
 * Creates an authentication packet.
 * @param password - The RCON password
 * @returns The formatted auth packet string
 */
export function createAuthPacket(password: string): string {
	return `${String.fromCharCode(Protocol.AUTH_PREFIX)}${password}${String.fromCharCode(Protocol.TERMINATOR)}`;
}

/**
 * Creates a command packet.
 * @param command - The command to execute
 * @param params - Optional parameters for the command
 * @returns The formatted command packet string
 * @throws {RCONError} If the command is not valid
 */
export function createCommandPacket(command: Command, params?: string): string {
	const code = getCommandCode(command);

	if (code === undefined) {
		throw new RCONError(RCONErrorCode.INVALID_COMMAND, `Unknown command: ${command}`);
	}

	const paramString = params ?? '';
	return `${String.fromCharCode(Protocol.COMMAND_PREFIX)}${String.fromCharCode(code)}${paramString}${String.fromCharCode(Protocol.TERMINATOR)}`;
}

/**
 * Socket wrapper providing Promise-based operations with proper cleanup.
 */
export class ProtocolSocket {
	private socket: Socket | null = null;
	private state: ConnectionState = 'disconnected';
	private readonly timeout: number;

	constructor(timeout = 10000) {
		this.timeout = timeout;
	}

	/**
	 * Get current connection state.
	 */
	get connectionState(): ConnectionState {
		return this.state;
	}

	/**
	 * Check if socket is connected.
	 */
	get isConnected(): boolean {
		return this.state === 'connected' && this.socket !== null && !this.socket.destroyed;
	}

	/**
	 * Connect to a server.
	 * @param host - Server hostname or IP
	 * @param port - Server port
	 * @returns Promise that resolves when connected
	 */
	async connect(host: string, port: number): Promise<void> {
		if (this.isConnected) {
			return;
		}

		this.state = 'connecting';

		return new Promise((resolve, reject) => {
			const timeoutId = globalThis.setTimeout(() => {
				this.cleanup();
				reject(new RCONError(RCONErrorCode.TIMEOUT, `Connection timeout after ${this.timeout}ms`));
			}, this.timeout);

			this.socket = new Socket();

			const cleanup = (error?: Error) => {
				globalThis.clearTimeout(timeoutId);
				this.socket?.removeAllListeners();
				if (error) {
					this.state = 'error';
					reject(error);
				}
			};

			this.socket.once('error', (err: Error) => {
				cleanup(new RCONError(RCONErrorCode.CONNECTION_FAILED, `Connection failed: ${err.message}`, err));
			});

			this.socket.connect(port, host, () => {
				globalThis.clearTimeout(timeoutId);
				this.state = 'connected';
				resolve();
			});
		});
	}

	/**
	 * Send data to the server.
	 * @param data - Data to send
	 * @returns Promise that resolves when data is sent
	 */
	async send(data: string): Promise<void> {
		if (!this.isConnected || !this.socket) {
			throw new RCONError(RCONErrorCode.NOT_CONNECTED, 'Socket is not connected');
		}

		return new Promise((resolve, reject) => {
			this.socket!.write(data, Protocol.ENCODING, (err: Error | undefined) => {
				if (err) {
					reject(new RCONError(RCONErrorCode.SOCKET_ERROR, `Failed to send data: ${err.message}`, err));
				} else {
					resolve();
				}
			});
		});
	}

	/**
	 * Receive data from the server.
	 * @returns Promise that resolves with the received data
	 */
	async receive(): Promise<string> {
		if (!this.isConnected || !this.socket) {
			throw new RCONError(RCONErrorCode.NOT_CONNECTED, 'Socket is not connected');
		}

		return new Promise((resolve, reject) => {
			const timeoutId = globalThis.setTimeout(() => {
				this.socket?.removeAllListeners('data');
				reject(new RCONError(RCONErrorCode.TIMEOUT, `Response timeout after ${this.timeout}ms`));
			}, this.timeout);

			this.socket!.once('data', (data: Buffer) => {
				globalThis.clearTimeout(timeoutId);
				resolve(data.toString(Protocol.ENCODING));
			});
		});
	}

	/**
	 * Send data and wait for response.
	 * @param data - Data to send
	 * @returns Promise that resolves with the response
	 */
	async sendAndReceive(data: string): Promise<string> {
		await this.send(data);
		return this.receive();
	}

	/**
	 * Disconnect from the server.
	 */
	disconnect(): void {
		this.cleanup();
	}

	/**
	 * Clean up resources.
	 */
	private cleanup(): void {
		if (this.socket) {
			this.socket.removeAllListeners();
			this.socket.destroy();
			this.socket = null;
		}
		this.state = 'disconnected';
	}
}

/**
 * Parse player list response into structured data.
 * @param response - Raw response string from players command
 * @returns Array of parsed player entries
 */
export function parsePlayersResponse(response: string): Array<{ steamId: string; name: string; raw: string }> {
	const players: Array<{ steamId: string; name: string; raw: string }> = [];

	// Split by newlines and filter empty lines
	const lines = response.split('\n').filter((line) => line.trim());

	for (const line of lines) {
		// Try to extract Steam ID (typically 17 digit number)
		const steamIdMatch = line.match(/(\d{17})/);
		if (steamIdMatch?.[1]) {
			// Extract name - typically after the Steam ID, separated by comma or space
			const afterId = line.substring(line.indexOf(steamIdMatch[1]) + 17);
			// Remove leading separators (comma, space) and get the name
			const cleaned = afterId.replace(/^[,\s]+/, '');
			const namePart = cleaned.split(/[,\s]/)[0];
			const name = namePart?.trim() || 'Unknown';

			players.push({
				steamId: steamIdMatch[1],
				name,
				raw: line,
			});
		}
	}

	return players;
}

/**
 * Parse server details response.
 * @param response - Raw response string
 * @returns Parsed server details object
 */
export function parseServerDetailsResponse(response: string): Record<string, string> {
	const details: Record<string, string> = {};

	// Try to parse key:value or key=value pairs
	const pairs = response.split(/[,\n]/);
	for (const pair of pairs) {
		const parts = pair.split(/[:=]/);
		const key = parts[0];
		const value = parts[1];
		if (key && value) {
			details[key.trim().toLowerCase()] = value.trim();
		}
	}

	details['raw'] = response;
	return details;
}
