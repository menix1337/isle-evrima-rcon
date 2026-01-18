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
 * Player entry from the players command.
 * Server returns: SteamId, Name, EOSId (in that order)
 */
export interface ParsedPlayer {
	steamId: string;
	name: string;
	eosId?: string;
	raw: string;
}

/**
 * Parse player list response into structured data.
 *
 * Server format (grouped by type, not per-player):
 * ```
 * PlayerList
 * SteamId1,SteamId2,SteamId3,
 * Name1,Name2,Name3,
 * EOSId1,EOSId2,EOSId3,
 * ```
 *
 * @param response - Raw response string from players command
 * @returns Array of parsed player entries
 */
export function parsePlayersResponse(response: string): ParsedPlayer[] {
	const players: ParsedPlayer[] = [];

	// Split by newlines and filter empty lines
	const lines = response.split('\n').filter((line) => line.trim());

	if (lines.length === 0) {
		return players;
	}

	// Skip "PlayerList" header if present
	let dataStartIndex = 0;
	if (lines[0]?.toLowerCase() === 'playerlist') {
		dataStartIndex = 1;
	}

	// Extract the data lines
	const steamIdsLine = lines[dataStartIndex] ?? '';
	const namesLine = lines[dataStartIndex + 1] ?? '';
	const eosIdsLine = lines[dataStartIndex + 2] ?? '';

	// Parse each line into arrays (split by comma, filter empty)
	const steamIds = steamIdsLine
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	const names = namesLine
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	const eosIds = eosIdsLine
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);

	// Zip them together - use steamIds as the primary count
	for (let i = 0; i < steamIds.length; i++) {
		const steamId = steamIds[i];
		if (!steamId) continue;

		const name = names[i] ?? 'Unknown';
		const eosIdCandidate = eosIds[i];
		// EOS ID validation: typically 32-char hex, but be lenient
		const eosId = eosIdCandidate && eosIdCandidate.length > 0 ? eosIdCandidate : undefined;

		players.push({
			steamId,
			name,
			...(eosId && { eosId }),
			raw: `${steamId},${name}${eosId ? `,${eosId}` : ''}`,
		});
	}

	return players;
}

/**
 * Parsed player data from playData command.
 */
export interface ParsedPlayerData {
	steamId?: string;
	name?: string;
	eosId?: string;
	character?: string;
	isAlive?: boolean;
	mutations?: string[];
	isPrime?: boolean;
	raw: string;
}

/**
 * Parse detailed player data response.
 *
 * Response is wrapped with "PlayerData\n" prefix and "PlayerDataEnd\n" terminator.
 * Includes mutations, prime status, and other detailed info.
 *
 * @param response - Raw response string from playData command
 * @returns Parsed player data object
 */
export function parsePlayerDataResponse(response: string): ParsedPlayerData {
	const result: ParsedPlayerData = { raw: response };

	// Remove PlayerData/PlayerDataEnd markers if present
	let content = response;
	if (content.startsWith('PlayerData\n')) {
		content = content.substring('PlayerData\n'.length);
	}
	if (content.endsWith('PlayerDataEnd\n')) {
		content = content.substring(0, content.length - 'PlayerDataEnd\n'.length);
	} else if (content.endsWith('PlayerDataEnd')) {
		content = content.substring(0, content.length - 'PlayerDataEnd'.length);
	}

	// Parse key:value pairs
	const lines = content.split('\n').filter((line) => line.trim());

	for (const line of lines) {
		const colonIndex = line.indexOf(':');
		if (colonIndex === -1) continue;

		const key = line.substring(0, colonIndex).trim().toLowerCase();
		const value = line.substring(colonIndex + 1).trim();

		switch (key) {
			case 'steamid':
				result.steamId = value;
				break;
			case 'name':
				result.name = value;
				break;
			case 'eosid':
				result.eosId = value;
				break;
			case 'character':
			case 'dino':
			case 'dinosaur':
				result.character = value;
				break;
			case 'alive':
			case 'isalive':
				result.isAlive = value === '1' || value.toLowerCase() === 'true';
				break;
			case 'mutations':
				result.mutations = value
					.split(',')
					.map((m) => m.trim())
					.filter(Boolean);
				break;
			case 'prime':
			case 'isprime':
				result.isPrime = value === '1' || value.toLowerCase() === 'true';
				break;
		}
	}

	return result;
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
