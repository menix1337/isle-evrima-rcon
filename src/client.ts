/**
 * @fileoverview Main RCON client implementation for The Isle: Evrima servers.
 * @module isle-evrima-rcon/client
 */

import {
	type Command,
	type CommandResult,
	type ConnectionState,
	type ClientOptions,
	type ServerConfig,
	type PlayerInfo,
	type PlayerData,
	type ServerDetails,
	type AICreatureClass,
	RCONError,
	RCONErrorCode,
} from './types.js';
import {
	ProtocolSocket,
	createAuthPacket,
	createCommandPacket,
	Protocol,
	parsePlayersResponse,
	parsePlayerDataResponse,
	parseServerDetailsResponse,
} from './protocol.js';
import { getCommandDefinition, isValidCommand } from './commands.js';
import { validateClientOptions, validateServerConfig, isValidSteamId } from './validation.js';

/**
 * Logger interface for debug output.
 */
interface Logger {
	debug: (message: string, ...args: unknown[]) => void;
	info: (message: string, ...args: unknown[]) => void;
	warn: (message: string, ...args: unknown[]) => void;
	error: (message: string, ...args: unknown[]) => void;
}

/**
 * Create a logger based on debug setting and optional server name.
 */
function createLogger(debug: boolean, name?: string): Logger {
	const noop = () => {};
	const prefix = name ? `[RCON:${name}]` : '[RCON]';
	const log =
		(level: string) =>
		(message: string, ...args: unknown[]) => {
			globalThis.console.log(`${prefix}[${level}] ${message}`, ...args);
		};

	return {
		debug: debug ? log('DEBUG') : noop,
		info: debug ? log('INFO') : noop,
		warn: log('WARN'),
		error: log('ERROR'),
	};
}

// ============================================================================
// Command Input Types - Professional typed parameters for each command
// ============================================================================

/** Input for batch command execution */
export interface CommandInput {
	readonly command: Command;
	readonly params?: string;
}

/** Ban command parameters */
export interface BanParams {
	readonly steamId: string;
	readonly reason?: string;
}

/** Kick command parameters */
export interface KickParams {
	readonly steamId: string;
	readonly reason?: string;
}

/** Direct message parameters */
export interface DirectMessageParams {
	readonly steamId: string;
	readonly message: string;
}

/** AI density value (0.0 to 1.0) */
export type AiDensity = number;

// ============================================================================
// Main Client Class
// ============================================================================

/**
 * High-performance RCON client for The Isle: Evrima servers.
 *
 * Supports persistent connections, automatic reconnection with exponential backoff,
 * and multi-server management through named instances.
 *
 * @example Basic Usage
 * ```typescript
 * const client = new EvrimaRCON('192.168.1.100', 8888, 'password');
 * await client.connect();
 * await client.announce('Server restart in 5 minutes!');
 * const players = await client.getPlayers();
 * client.disconnect();
 * ```
 *
 * @example With Auto-Reconnect
 * ```typescript
 * const client = new EvrimaRCON('192.168.1.100', 8888, 'password', {
 *   autoReconnect: true,
 *   maxReconnectAttempts: 5,
 *   name: 'main-server' // Identifies this server in logs
 * });
 * await client.connect();
 * // Connection will auto-recover if dropped
 * ```
 */
export class EvrimaRCON {
	/** Library version */
	static readonly VERSION = '1.0.0';

	private readonly host: string;
	private readonly port: number;
	private readonly password: string;
	private readonly options: ReturnType<typeof validateClientOptions>;
	private readonly logger: Logger;
	private socket: ProtocolSocket | null = null;
	private reconnectAttempts = 0;

	/**
	 * Creates a new RCON client instance.
	 * @param host - Server IP address or hostname
	 * @param port - RCON port number
	 * @param password - RCON password
	 * @param options - Optional client configuration
	 */
	constructor(host: string, port: number, password: string, options?: ClientOptions) {
		const config = validateServerConfig({ ip: host, port, password });
		this.host = config.ip;
		this.port = config.port;
		this.password = config.password;
		this.options = validateClientOptions(options);
		this.logger = createLogger(this.options.debug, this.options.name);
	}

	/** Get the current connection state. */
	get state(): ConnectionState {
		return this.socket?.connectionState ?? 'disconnected';
	}

	/** Check if the client is connected and authenticated. */
	get isConnected(): boolean {
		return this.socket?.isConnected ?? false;
	}

	// ========================================================================
	// Connection Management
	// ========================================================================

	/**
	 * Connect to the RCON server and authenticate.
	 * @returns Promise resolving to true if connection and auth succeed
	 * @throws {RCONError} On connection or authentication failure
	 */
	async connect(): Promise<boolean> {
		if (this.isConnected) {
			this.logger.debug('Already connected');
			return true;
		}

		this.logger.info(`Connecting to ${this.host}:${this.port}`);

		try {
			this.socket = new ProtocolSocket(this.options.timeout);
			await this.socket.connect(this.host, this.port);
			this.logger.debug('Socket connected, authenticating...');

			await this.authenticate();
			this.logger.info('Successfully connected and authenticated');

			this.reconnectAttempts = 0;
			return true;
		} catch (error) {
			this.logger.error('Connection failed', error);
			this.cleanup();

			if (this.options.autoReconnect && this.reconnectAttempts < this.options.maxReconnectAttempts) {
				return this.attemptReconnect();
			}

			throw error;
		}
	}

	/** Disconnect from the server. */
	disconnect(): void {
		this.logger.info('Disconnecting...');
		this.cleanup();
	}

	// ========================================================================
	// Server Management Commands
	// ========================================================================

	/**
	 * Send a server-wide announcement.
	 * @param message - The message to announce to all players
	 */
	async announce(message: string): Promise<CommandResult> {
		return this.sendCommand('announce', message);
	}

	/**
	 * Send a direct message to a specific player.
	 * @param params - Player Steam ID and message
	 */
	async directMessage(params: DirectMessageParams): Promise<CommandResult> {
		return this.sendCommand('dm', `${params.steamId},${params.message}`);
	}

	/**
	 * Get server details and configuration.
	 * @returns Parsed server details
	 */
	async getServerDetails(): Promise<ServerDetails> {
		const result = await this.sendCommand('srv:details');
		const parsed = parseServerDetailsResponse(result.raw);

		const name = parsed['name'];
		const map = parsed['map'];
		const version = parsed['version'];
		const players = parsed['players'];

		let playerCount: number | undefined;
		let maxPlayers: number | undefined;

		if (players) {
			const parts = players.split('/');
			if (parts[0]) playerCount = parseInt(parts[0], 10);
			if (parts[1]) maxPlayers = parseInt(parts[1], 10);
		}

		// Build object with only defined properties (exactOptionalPropertyTypes compliance)
		return {
			raw: result.raw,
			...(name !== undefined && { name }),
			...(map !== undefined && { map }),
			...(version !== undefined && { version }),
			...(playerCount !== undefined && { playerCount }),
			...(maxPlayers !== undefined && { maxPlayers }),
		};
	}

	/**
	 * Remove all corpses from the map.
	 */
	async wipeCorpses(): Promise<CommandResult> {
		return this.sendCommand('entities:wipe:corpses');
	}

	/**
	 * Get list of available playable dinosaurs/characters.
	 */
	async getPlayables(): Promise<CommandResult> {
		return this.sendCommand('getplayables');
	}

	/**
	 * Update playable characters configuration.
	 * @param config - Configuration string (e.g., "dino1:enabled,dino2:disabled")
	 */
	async updatePlayables(config: string): Promise<CommandResult> {
		return this.sendCommand('updateplayables', config);
	}

	/**
	 * Toggle dinosaur migrations on/off.
	 * @param enabled - True to enable, false to disable
	 */
	async setMigrations(enabled: boolean): Promise<CommandResult> {
		return this.sendCommand('migrations:toggle', enabled ? '1' : '0');
	}

	/**
	 * Trigger a server save.
	 */
	async save(): Promise<CommandResult> {
		return this.sendCommand('save');
	}

	/**
	 * Pause or unpause the server.
	 * @param paused - True to pause, false to unpause
	 */
	async setPaused(paused: boolean): Promise<CommandResult> {
		return this.sendCommand('pause', paused ? '1' : '0');
	}

	// ========================================================================
	// Player Management Commands
	// ========================================================================

	/**
	 * Get list of all online players.
	 *
	 * Returns SteamId, Name, and EOSId (Epic Online Services ID) for each player.
	 *
	 * @returns Array of parsed player information
	 */
	async getPlayers(): Promise<PlayerInfo[]> {
		const result = await this.sendCommand('players');
		return parsePlayersResponse(result.raw);
	}

	/**
	 * Get detailed player data including mutations and prime status.
	 *
	 * Response is wrapped with "PlayerData\n" prefix and "PlayerDataEnd\n" terminator.
	 *
	 * @param steamId - Optional Steam ID to filter by
	 * @returns Parsed player data with mutations, prime status, etc.
	 */
	async getPlayerData(steamId?: string): Promise<PlayerData> {
		const result = await this.sendCommand('playData', steamId);
		const parsed = parsePlayerDataResponse(result.raw);
		return {
			raw: result.raw,
			...(parsed.steamId && { steamId: parsed.steamId }),
			...(parsed.name && { name: parsed.name }),
			...(parsed.eosId && { eosId: parsed.eosId }),
			...(parsed.character && { character: parsed.character }),
			...(parsed.isAlive !== undefined && { isAlive: parsed.isAlive }),
			...(parsed.mutations && { mutations: parsed.mutations }),
			...(parsed.isPrime !== undefined && { isPrime: parsed.isPrime }),
		};
	}

	/**
	 * Ban a player from the server.
	 * @param params - Steam ID and optional reason
	 */
	async ban(params: BanParams): Promise<CommandResult> {
		if (!isValidSteamId(params.steamId)) {
			throw new RCONError(RCONErrorCode.INVALID_COMMAND, `Invalid Steam ID: ${params.steamId}`);
		}
		const paramString = params.reason ? `${params.steamId},${params.reason}` : params.steamId;
		return this.sendCommand('ban', paramString);
	}

	/**
	 * Kick a player from the server.
	 * @param params - Steam ID and optional reason
	 */
	async kick(params: KickParams): Promise<CommandResult> {
		if (!isValidSteamId(params.steamId)) {
			throw new RCONError(RCONErrorCode.INVALID_COMMAND, `Invalid Steam ID: ${params.steamId}`);
		}
		const paramString = params.reason ? `${params.steamId},${params.reason}` : params.steamId;
		return this.sendCommand('kick', paramString);
	}

	// ========================================================================
	// Growth & Network Settings
	// ========================================================================

	/**
	 * Toggle growth multiplier feature on/off.
	 * @param enabled - True to enable, false to disable
	 */
	async setGrowthMultiplier(enabled: boolean): Promise<CommandResult> {
		return this.sendCommand('growth:multiplier:toggle', enabled ? '1' : '0');
	}

	/**
	 * Set the growth multiplier value.
	 * @param multiplier - Growth multiplier value (e.g., 1.5 for 150% growth speed)
	 */
	async setGrowthMultiplierValue(multiplier: number): Promise<CommandResult> {
		if (multiplier < 0) {
			throw new RCONError(
				RCONErrorCode.INVALID_COMMAND,
				`Growth multiplier must be positive, got: ${multiplier}`
			);
		}
		return this.sendCommand('growth:multiplier:set', multiplier.toString());
	}

	/**
	 * Toggle network update distance checks.
	 * @param enabled - True to enable, false to disable
	 */
	async setNetUpdateDistanceChecks(enabled: boolean): Promise<CommandResult> {
		return this.sendCommand('netupdate:toggle', enabled ? '1' : '0');
	}

	// ========================================================================
	// Whitelist Commands
	// ========================================================================

	/**
	 * Enable or disable the server whitelist.
	 * @param enabled - True to enable, false to disable
	 */
	async setWhitelist(enabled: boolean): Promise<CommandResult> {
		return this.sendCommand('whitelist:toggle', enabled ? '1' : '0');
	}

	/**
	 * Add a player to the whitelist.
	 * @param steamId - Player's Steam ID
	 */
	async whitelistAdd(steamId: string): Promise<CommandResult> {
		if (!isValidSteamId(steamId)) {
			throw new RCONError(RCONErrorCode.INVALID_COMMAND, `Invalid Steam ID: ${steamId}`);
		}
		return this.sendCommand('whitelist:add', steamId);
	}

	/**
	 * Remove a player from the whitelist.
	 * @param steamId - Player's Steam ID
	 */
	async whitelistRemove(steamId: string): Promise<CommandResult> {
		if (!isValidSteamId(steamId)) {
			throw new RCONError(RCONErrorCode.INVALID_COMMAND, `Invalid Steam ID: ${steamId}`);
		}
		return this.sendCommand('whitelist:remove', steamId);
	}

	// ========================================================================
	// Game Feature Toggles
	// ========================================================================

	/**
	 * Enable or disable global chat.
	 * @param enabled - True to enable, false to disable
	 */
	async setGlobalChat(enabled: boolean): Promise<CommandResult> {
		return this.sendCommand('globalchat:toggle', enabled ? '1' : '0');
	}

	/**
	 * Enable or disable human characters.
	 * @param enabled - True to enable, false to disable
	 */
	async setHumans(enabled: boolean): Promise<CommandResult> {
		return this.sendCommand('humans:toggle', enabled ? '1' : '0');
	}

	// ========================================================================
	// AI Controls
	// ========================================================================

	/**
	 * Enable or disable AI on the server.
	 * @param enabled - True to enable, false to disable
	 */
	async setAI(enabled: boolean): Promise<CommandResult> {
		return this.sendCommand('ai:toggle', enabled ? '1' : '0');
	}

	/**
	 * Disable specific ambient AI creature classes.
	 *
	 * These are NPC wildlife (not playable dinosaurs) like Compsognathus, Deer, Boar, etc.
	 *
	 * @param classes - Array of AI creature class names to disable
	 *
	 * @example
	 * ```typescript
	 * // Type-safe with autocomplete
	 * await client.disableAIClasses(['Compsognathus', 'Deer', 'Boar']);
	 *
	 * // Or use the AI_CREATURE_CLASSES constant
	 * import { AI_CREATURE_CLASSES } from 'isle-evrima-rcon';
	 * ```
	 */
	async disableAIClasses(classes: (AICreatureClass | string)[]): Promise<CommandResult> {
		return this.sendCommand('ai:classes:disable', classes.join(','));
	}

	/**
	 * Set AI density in the game world.
	 * @param density - Value between 0.0 and 1.0
	 */
	async setAIDensity(density: AiDensity): Promise<CommandResult> {
		if (density < 0 || density > 1) {
			throw new RCONError(
				RCONErrorCode.INVALID_COMMAND,
				`AI density must be between 0.0 and 1.0, got: ${density}`
			);
		}
		return this.sendCommand('ai:density', density.toString());
	}

	/**
	 * Get the current server queue status.
	 */
	async getQueueStatus(): Promise<CommandResult> {
		return this.sendCommand('queue:status');
	}

	/**
	 * Toggle AI learning behavior on/off.
	 *
	 * **Warning:** This command may only work on official servers.
	 *
	 * @param enabled - True to enable, false to disable
	 */
	async setAILearning(enabled: boolean): Promise<CommandResult> {
		return this.sendCommand('ai:learning:toggle', enabled ? '1' : '0');
	}

	// ========================================================================
	// Generic Command Execution
	// ========================================================================

	/**
	 * Send a raw command to the server.
	 * Use convenience methods when available for better type safety.
	 *
	 * If `autoReconnect` is enabled and the connection is lost, this method
	 * will automatically attempt to reconnect before throwing an error.
	 *
	 * @param command - The command to execute
	 * @param params - Optional parameters for the command
	 */
	async sendCommand(command: Command, params?: string): Promise<CommandResult> {
		// Ensure connection (with auto-reconnect if enabled)
		await this.ensureConnected();

		if (!isValidCommand(command)) {
			return this.createResult(command, false, '', `Unknown command: ${command}`);
		}

		const definition = getCommandDefinition(command);
		this.logger.debug(`Executing command: ${command}`, { params, definition });

		try {
			const packet = createCommandPacket(command, params);
			const response = await this.socket!.sendAndReceive(packet);

			this.logger.debug(`Response received for ${command}:`, response);

			const formattedData = this.formatResponse(command, params, response);
			return this.createResult(command, true, response, formattedData);
		} catch (error) {
			// Connection may have dropped - try to reconnect once if enabled
			if (this.options.autoReconnect && this.isConnectionError(error)) {
				this.logger.warn('Connection lost during command, attempting reconnect...');
				this.cleanup();

				try {
					await this.connect();
					// Retry the command once after reconnect
					const packet = createCommandPacket(command, params);
					const response = await this.socket!.sendAndReceive(packet);
					const formattedData = this.formatResponse(command, params, response);
					return this.createResult(command, true, response, formattedData);
				} catch (reconnectError) {
					this.logger.error('Reconnect failed', reconnectError);
					throw reconnectError;
				}
			}

			const message = error instanceof Error ? error.message : 'Unknown error';
			this.logger.error(`Command failed: ${command}`, error);

			if (error instanceof RCONError) {
				throw error;
			}

			return this.createResult(command, false, '', message);
		}
	}

	/**
	 * Ensure the client is connected, attempting to reconnect if needed.
	 */
	private async ensureConnected(): Promise<void> {
		if (this.isConnected && this.socket) {
			return;
		}

		if (this.options.autoReconnect) {
			this.logger.info('Not connected, attempting to connect...');
			await this.connect();
		} else {
			throw new RCONError(RCONErrorCode.NOT_CONNECTED, 'Client is not connected');
		}
	}

	/**
	 * Check if an error is a connection-related error.
	 */
	private isConnectionError(error: unknown): boolean {
		if (error instanceof RCONError) {
			return (
				error.code === RCONErrorCode.NOT_CONNECTED ||
				error.code === RCONErrorCode.SOCKET_ERROR ||
				error.code === RCONErrorCode.TIMEOUT
			);
		}
		return false;
	}

	/**
	 * Execute multiple commands in sequence.
	 * @param commands - Array of command objects
	 * @returns Promise resolving to array of results
	 *
	 * @example
	 * ```typescript
	 * const results = await client.batch([
	 *   { command: 'announce', params: 'First message' },
	 *   { command: 'announce', params: 'Second message' },
	 *   { command: 'players' },
	 * ]);
	 * ```
	 */
	async batch(commands: CommandInput[]): Promise<CommandResult[]> {
		const results: CommandResult[] = [];

		for (const cmd of commands) {
			const result = await this.sendCommand(cmd.command, cmd.params);
			results.push(result);
		}

		return results;
	}

	/**
	 * Execute a custom command.
	 * @param commandString - Raw command string
	 */
	async custom(commandString: string): Promise<CommandResult> {
		return this.sendCommand('custom', commandString);
	}

	// ========================================================================
	// Private Methods
	// ========================================================================

	private async attemptReconnect(): Promise<boolean> {
		this.reconnectAttempts++;

		// Exponential backoff: 1s, 2s, 4s, 8s... (capped at 30s)
		const backoffDelay = Math.min(this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);

		this.logger.info(
			`Reconnection attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts} (waiting ${backoffDelay}ms)`
		);

		await this.delay(backoffDelay);
		return this.connect();
	}

	private async authenticate(): Promise<void> {
		if (!this.socket) {
			throw new RCONError(RCONErrorCode.NOT_CONNECTED, 'Socket not initialized');
		}

		const authPacket = createAuthPacket(this.password);
		const response = await this.socket.sendAndReceive(authPacket);

		if (!response.includes(Protocol.AUTH_SUCCESS)) {
			throw new RCONError(RCONErrorCode.AUTH_FAILED, 'Authentication failed: invalid password');
		}
	}

	private formatResponse(command: Command, params: string | undefined, response: string): string {
		switch (command) {
			case 'announce':
			case 'ban':
			case 'kick':
				return `command:${response}:${params ?? ''}`;
			case 'players':
			case 'dm':
				return `[${command}]:${response}`;
			default:
				return response;
		}
	}

	private createResult(command: Command, success: boolean, raw: string, data: string): CommandResult {
		return { success, data, raw, timestamp: new Date(), command };
	}

	private cleanup(): void {
		if (this.socket) {
			this.socket.disconnect();
			this.socket = null;
		}
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
	}
}

// ============================================================================
// Convenience Function for One-Shot Commands
// ============================================================================

/**
 * Execute a one-shot RCON command.
 * Connects, executes command, and disconnects automatically.
 *
 * @example
 * ```typescript
 * const result = await rcon({
 *   host: { ip: '127.0.0.1', port: 8888, password: 'secret' },
 *   command: { name: 'players' }
 * });
 * ```
 */
export async function rcon(config: {
	host: ServerConfig;
	command: { name: Command; params?: string };
	options?: ClientOptions;
}): Promise<CommandResult> {
	const { host, command, options } = config;
	const validatedHost = validateServerConfig(host);

	if (!isValidCommand(command.name)) {
		throw new RCONError(RCONErrorCode.INVALID_COMMAND, `Invalid command: ${command.name}`);
	}

	const client = new EvrimaRCON(validatedHost.ip, validatedHost.port, validatedHost.password, options);

	try {
		const connected = await client.connect();

		if (!connected) {
			throw new RCONError(
				RCONErrorCode.CONNECTION_FAILED,
				`Failed to connect to ${validatedHost.ip}:${validatedHost.port}`
			);
		}

		return await client.sendCommand(command.name, command.params);
	} finally {
		client.disconnect();
	}
}
