/**
 * @fileoverview Core type definitions for the Isle Evrima RCON library.
 * @module isle-evrima-rcon/types
 */

/**
 * All available RCON commands supported by The Isle: Evrima servers.
 *
 * Commands are organized by category:
 * - Core: auth, command (internal protocol)
 * - Server: announce, dm, srv:details, etc.
 * - Player: ban, kick, players, playData
 * - World: save, pause
 * - Whitelist: whitelist:*
 * - Features: globalchat, humans, migrations, growth
 * - AI: ai:*
 */
export type Command =
	// Core protocol commands
	| 'auth'
	| 'command'
	// Server management (0x10-0x1F)
	| 'announce'
	| 'dm'
	| 'srv:details'
	| 'entities:wipe:corpses'
	| 'getplayables'
	| 'updateplayables'
	| 'migrations:toggle'
	// Player management (0x20-0x4F)
	| 'ban'
	| 'growth:multiplier:toggle'
	| 'growth:multiplier:set'
	| 'netupdate:toggle'
	| 'kick'
	| 'players'
	// World management (0x50-0x7F)
	| 'save'
	| 'pause'
	| 'custom'
	| 'playData'
	// Whitelist (0x81-0x83)
	| 'whitelist:toggle'
	| 'whitelist:add'
	| 'whitelist:remove'
	// Game features (0x84-0x8F)
	| 'globalchat:toggle'
	| 'humans:toggle'
	// AI controls (0x90+)
	| 'ai:toggle'
	| 'ai:classes:disable'
	| 'ai:density'
	| 'queue:status'
	| 'ai:learning:toggle';

/**
 * Server connection configuration.
 */
export interface ServerConfig {
	/** Server IP address (IPv4 format) */
	readonly ip: string;
	/** RCON port number (1-65535) */
	readonly port: number;
	/** RCON password for authentication */
	readonly password: string;
}

/**
 * Client configuration options.
 *
 * @example
 * ```typescript
 * const options: ClientOptions = {
 *   timeout: 10000,
 *   autoReconnect: true,
 *   maxReconnectAttempts: 5,
 *   reconnectDelay: 1000,
 *   debug: true,
 *   name: 'us-west-server'
 * };
 * ```
 */
export interface ClientOptions {
	/**
	 * Connection timeout in milliseconds.
	 * @default 10000
	 */
	readonly timeout?: number;

	/**
	 * Enable automatic reconnection when connection drops.
	 * Uses exponential backoff to prevent server overload.
	 * @default false
	 */
	readonly autoReconnect?: boolean;

	/**
	 * Maximum reconnection attempts before giving up.
	 * Only used when `autoReconnect` is enabled.
	 * @default 3
	 */
	readonly maxReconnectAttempts?: number;

	/**
	 * Base delay between reconnection attempts in milliseconds.
	 * Actual delays use exponential backoff: 1s → 2s → 4s → 8s (capped at 30s).
	 * @default 1000
	 */
	readonly reconnectDelay?: number;

	/**
	 * Enable debug logging to console.
	 * Useful for development and troubleshooting.
	 * @default false
	 */
	readonly debug?: boolean;

	/**
	 * Optional server name for log identification.
	 * Useful when managing multiple server connections.
	 * @default "host:port"
	 */
	readonly name?: string;
}

/**
 * Result of a command execution.
 */
export interface CommandResult<T = string> {
	/** Whether the command was executed successfully */
	readonly success: boolean;
	/** The response data from the server */
	readonly data: T;
	/** Raw response string from the server */
	readonly raw: string;
	/** Timestamp when the command was executed */
	readonly timestamp: Date;
	/** Command that was executed */
	readonly command: Command;
}

/**
 * Connection state of the RCON client.
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'authenticating' | 'connected' | 'error';

/**
 * Event types emitted by the RCON client.
 */
export interface ClientEvents {
	connect: () => void;
	disconnect: (reason?: string) => void;
	error: (error: Error) => void;
	reconnecting: (attempt: number) => void;
	command: (command: Command, params?: string) => void;
	response: (result: CommandResult) => void;
}

/**
 * Player information returned by the players command.
 *
 * The server returns data in order: SteamId, Name, EOSId
 */
export interface PlayerInfo {
	/** Steam ID of the player (17-digit number) */
	readonly steamId: string;
	/** In-game display name of the player */
	readonly name: string;
	/** Epic Online Services ID of the player */
	readonly eosId?: string;
	/** Raw line from server response */
	readonly raw?: string;
}

/**
 * Detailed player data returned by the playData command.
 *
 * Response is wrapped with "PlayerData\n" prefix and "PlayerDataEnd\n" terminator.
 * Fields may vary depending on server version and player state.
 */
export interface PlayerData {
	/** Steam ID of the player */
	readonly steamId?: string;
	/** In-game display name */
	readonly name?: string;
	/** Epic Online Services ID */
	readonly eosId?: string;
	/** Current dinosaur/character being played */
	readonly character?: string;
	/** Whether the player is alive */
	readonly isAlive?: boolean;
	/** Player's mutation data (new in recent patches) */
	readonly mutations?: string[];
	/** Whether player has prime/premium status */
	readonly isPrime?: boolean;
	/** Raw response data */
	readonly raw: string;
}

/**
 * Server details returned by srv:details command.
 */
export interface ServerDetails {
	/** Server name */
	readonly name?: string;
	/** Current player count */
	readonly playerCount?: number;
	/** Maximum players allowed */
	readonly maxPlayers?: number;
	/** Current map */
	readonly map?: string;
	/** Server version */
	readonly version?: string;
	/** Raw response data */
	readonly raw: string;
}

/**
 * Command definition with metadata.
 */
export interface CommandDefinition {
	/** Byte code for the command */
	readonly code: number;
	/** Human-readable description */
	readonly description: string;
	/** Whether the command requires parameters */
	readonly requiresParams: boolean;
	/** Example usage */
	readonly example?: string;
}

/**
 * Error codes for RCON operations.
 */
export enum RCONErrorCode {
	CONNECTION_FAILED = 'CONNECTION_FAILED',
	AUTH_FAILED = 'AUTH_FAILED',
	TIMEOUT = 'TIMEOUT',
	SOCKET_ERROR = 'SOCKET_ERROR',
	INVALID_COMMAND = 'INVALID_COMMAND',
	NOT_CONNECTED = 'NOT_CONNECTED',
	PARSE_ERROR = 'PARSE_ERROR',
}

/**
 * Custom error class for RCON operations.
 */
export class RCONError extends Error {
	readonly code: RCONErrorCode;
	readonly details?: unknown;

	constructor(code: RCONErrorCode, message: string, details?: unknown) {
		super(message);
		this.name = 'RCONError';
		this.code = code;
		this.details = details;
		Object.setPrototypeOf(this, RCONError.prototype);
	}
}

// ============================================================================
// Game Constants
// ============================================================================

/**
 * All playable dinosaur/creature classes in The Isle: Evrima.
 *
 * Used for commands like `updateplayables` and `getplayables`.
 * List is current as of January 2026 and may expand with game updates.
 */
export const PLAYABLE_DINOSAURS = [
	// Herbivores
	'Dryosaurus',
	'Hypsilophodon',
	'Pachycephalosaurus',
	'Stegosaurus',
	'Tenontosaurus',
	'Diabloceratops',
	'Maiasaura',
	'Triceratops',
	// Carnivores
	'Carnotaurus',
	'Ceratosaurus',
	'Deinosuchus',
	'Omniraptor',
	'Pteranodon',
	'Troodon',
	'Beipiaosaurus',
	'Gallimimus',
	'Dilophosaurus',
	'Herrerasaurus',
	'Allosaurus',
	'Tyrannosaurus',
] as const;

/**
 * Type representing valid playable dinosaur names.
 */
export type PlayableDinosaur = (typeof PLAYABLE_DINOSAURS)[number];

/**
 * Ambient AI creature classes that can be toggled/disabled.
 *
 * These are the NPC wildlife that spawn in the world, NOT playable dinosaurs.
 * Used for the `disableAIClasses` command.
 */
export const AI_CREATURE_CLASSES = [
	'Compsognathus',
	'Pterodactylus',
	'Boar',
	'Deer',
	'Goat',
	'Seaturtle',
	'Rabbit',
	'Crab',
] as const;

/**
 * Type representing valid AI creature class names.
 */
export type AICreatureClass = (typeof AI_CREATURE_CLASSES)[number];
