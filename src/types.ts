/**
 * @fileoverview Core type definitions for the Isle Evrima RCON library.
 * @module isle-evrima-rcon/types
 */

/**
 * All available RCON commands supported by The Isle: Evrima servers.
 */
export type Command =
	| 'auth'
	| 'command'
	| 'announce'
	| 'dm'
	| 'srv:details'
	| 'entities:wipe:corpses'
	| 'updateplayables'
	| 'ban'
	| 'kick'
	| 'players'
	| 'save'
	| 'custom'
	| 'playData'
	| 'whitelist:toggle'
	| 'whitelist:add'
	| 'whitelist:remove'
	| 'globalchat:toggle'
	| 'humans:toggle'
	| 'ai:toggle'
	| 'ai:classes:disable'
	| 'ai:density';

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
 */
export interface PlayerInfo {
	/** Steam ID of the player */
	readonly steamId: string;
	/** In-game name of the player */
	readonly name: string;
	/** Current dinosaur/character being played */
	readonly character?: string;
	/** Whether the player is alive */
	readonly isAlive?: boolean;
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
