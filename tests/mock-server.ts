/**
 * @fileoverview Mock RCON server for testing without a real game server.
 * @module isle-evrima-rcon/tests/mock-server
 */

import { createServer, type Server, type Socket } from 'node:net';
import { Protocol } from '../src/protocol.js';

/**
 * Mock player data for testing.
 */
export const MockPlayers = [
	{ steamId: '76561198012345678', name: 'TestPlayer1', character: 'Carnotaurus' },
	{ steamId: '76561198087654321', name: 'TestPlayer2', character: 'Utahraptor' },
	{ steamId: '76561198011111111', name: 'AdminPlayer', character: 'Human' },
] as const;

/**
 * Mock server details.
 */
export const MockServerDetails = {
	name: 'Test Evrima Server',
	playerCount: MockPlayers.length,
	maxPlayers: 100,
	map: 'Isla Spiro',
	version: '0.14.52.1',
} as const;

/**
 * Configuration for the mock server.
 */
export interface MockServerConfig {
	/** Port to listen on */
	port: number;
	/** Password for authentication */
	password: string;
	/** Simulated response delay in ms */
	responseDelay?: number;
	/** Whether to accept all passwords (for testing auth failures) */
	acceptAllPasswords?: boolean;
}

/**
 * Mock RCON server that simulates The Isle: Evrima server responses.
 * Use this for testing without a real game server.
 */
export class MockRCONServer {
	private server: Server | null = null;
	private connections: Set<Socket> = new Set();
	private readonly config: Required<MockServerConfig>;
	private commandLog: Array<{ command: number; params: string; timestamp: Date }> = [];

	constructor(config: MockServerConfig) {
		this.config = {
			...config,
			responseDelay: config.responseDelay ?? 10,
			acceptAllPasswords: config.acceptAllPasswords ?? false,
		};
	}

	/**
	 * Get all logged commands for verification.
	 */
	get logs(): ReadonlyArray<{ command: number; params: string; timestamp: Date }> {
		return this.commandLog;
	}

	/**
	 * Clear command logs.
	 */
	clearLogs(): void {
		this.commandLog = [];
	}

	/**
	 * Start the mock server.
	 */
	async start(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.server = createServer((socket) => {
				this.handleConnection(socket);
			});

			this.server.on('error', (err) => {
				reject(err);
			});

			this.server.listen(this.config.port, '127.0.0.1', () => {
				globalThis.console.log(`[MockServer] Listening on 127.0.0.1:${this.config.port}`);
				resolve();
			});
		});
	}

	/**
	 * Stop the mock server and close all connections.
	 */
	async stop(): Promise<void> {
		return new Promise((resolve) => {
			// Close all connections
			for (const socket of this.connections) {
				socket.destroy();
			}
			this.connections.clear();

			// Close server
			if (this.server) {
				this.server.close(() => {
					globalThis.console.log('[MockServer] Server stopped');
					this.server = null;
					resolve();
				});
			} else {
				resolve();
			}
		});
	}

	/**
	 * Handle incoming connection.
	 */
	private handleConnection(socket: Socket): void {
		globalThis.console.log('[MockServer] Client connected');
		this.connections.add(socket);

		socket.on('data', (data: Buffer) => {
			this.handleData(socket, data);
		});

		socket.on('close', () => {
			globalThis.console.log('[MockServer] Client disconnected');
			this.connections.delete(socket);
		});

		socket.on('error', (err: Error) => {
			globalThis.console.error('[MockServer] Socket error:', err.message);
			this.connections.delete(socket);
		});
	}

	/**
	 * Handle incoming data.
	 */
	private handleData(socket: Socket, data: Buffer): void {
		const packet = data.toString('latin1');
		const packetType = packet.charCodeAt(0);

		globalThis.setTimeout(() => {
			if (packetType === Protocol.AUTH_PREFIX) {
				this.handleAuth(socket, packet);
			} else if (packetType === Protocol.COMMAND_PREFIX) {
				this.handleCommand(socket, packet);
			} else {
				socket.write(`Unknown packet type: ${packetType}\x00`, 'latin1');
			}
		}, this.config.responseDelay);
	}

	/**
	 * Handle authentication packet.
	 */
	private handleAuth(socket: Socket, packet: string): void {
		const password = packet.slice(1, -1); // Remove prefix and terminator

		if (this.config.acceptAllPasswords || password === this.config.password) {
			socket.write(`${Protocol.AUTH_SUCCESS}\x00`, 'latin1');
			globalThis.console.log('[MockServer] Client authenticated');
		} else {
			socket.write('Password Rejected\x00', 'latin1');
			globalThis.console.log('[MockServer] Authentication failed');
		}
	}

	/**
	 * Handle command packet.
	 */
	private handleCommand(socket: Socket, packet: string): void {
		const commandByte = packet.charCodeAt(1);
		const params = packet.slice(2, -1); // Remove prefix, command byte, and terminator

		// Log the command
		this.commandLog.push({
			command: commandByte,
			params,
			timestamp: new Date(),
		});

		globalThis.console.log(
			`[MockServer] Command: 0x${commandByte.toString(16).padStart(2, '0')}, Params: "${params}"`
		);

		// Generate response based on command
		const response = this.generateResponse(commandByte, params);
		socket.write(`${response}\x00`, 'latin1');
	}

	/**
	 * Generate mock response for a command.
	 */
	private generateResponse(commandByte: number, params: string): string {
		switch (commandByte) {
			// announce (0x10)
			case 0x10:
				return `Announcement sent: ${params}`;

			// dm (0x11)
			case 0x11:
				return `Message sent to player`;

			// srv:details (0x12)
			case 0x12:
				return [
					`name:${MockServerDetails.name}`,
					`players:${MockServerDetails.playerCount}/${MockServerDetails.maxPlayers}`,
					`map:${MockServerDetails.map}`,
					`version:${MockServerDetails.version}`,
				].join(',');

			// entities:wipe:corpses (0x13)
			case 0x13:
				return 'Corpses cleared: 15';

			// updateplayables (0x15)
			case 0x15:
				return `Playables updated: ${params}`;

			// ban (0x20)
			case 0x20:
				return `Player banned: ${params}`;

			// kick (0x30)
			case 0x30:
				return `Player kicked: ${params}`;

			// players (0x40) - Format: PlayerList header, then SteamIds, Names, EOSIds on separate lines
			case 0x40: {
				const steamIds = MockPlayers.map((p) => p.steamId).join(',') + ',';
				const names = MockPlayers.map((p) => p.name).join(',') + ',';
				const eosIds = MockPlayers.map((_, i) => `EOS${String(i + 1).padStart(3, '0')}`).join(',') + ',';
				return `PlayerList\n${steamIds}\n${names}\n${eosIds}`;
			}

			// save (0x50)
			case 0x50:
				return 'World saved successfully';

			// custom (0x70)
			case 0x70:
				return `Custom command executed: ${params}`;

			// playData (0x77)
			case 0x77:
				return JSON.stringify(MockPlayers);

			// whitelist:toggle (0x81)
			case 0x81:
				return params === '1' ? 'Whitelist enabled' : 'Whitelist disabled';

			// whitelist:add (0x82)
			case 0x82:
				return `Added to whitelist: ${params}`;

			// whitelist:remove (0x83)
			case 0x83:
				return `Removed from whitelist: ${params}`;

			// globalchat:toggle (0x84)
			case 0x84:
				return params === '1' ? 'Global chat enabled' : 'Global chat disabled';

			// humans:toggle (0x86)
			case 0x86:
				return params === '1' ? 'Humans enabled' : 'Humans disabled';

			// ai:toggle (0x90)
			case 0x90:
				return params === '1' ? 'AI enabled' : 'AI disabled';

			// ai:classes:disable (0x91)
			case 0x91:
				return `AI classes disabled: ${params}`;

			// ai:density (0x92)
			case 0x92:
				return `AI density set to: ${params}`;

			default:
				return `Unknown command: 0x${commandByte.toString(16)}`;
		}
	}
}

/**
 * Helper to create and start a mock server quickly.
 */
export async function createMockServer(
	port: number,
	password = 'testpassword'
): Promise<{ server: MockRCONServer; stop: () => Promise<void> }> {
	const server = new MockRCONServer({ port, password });
	await server.start();
	return {
		server,
		stop: () => server.stop(),
	};
}
