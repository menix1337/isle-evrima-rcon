/**
 * @fileoverview Isle Evrima RCON - High-performance TypeScript RCON client for The Isle: Evrima game servers.
 *
 * @description
 * This library provides a type-safe, production-ready RCON client with:
 * - Persistent connections with automatic reconnection and exponential backoff
 * - Type-safe convenience methods for all common operations
 * - Multi-server support with named instances for logging
 * - Comprehensive validation with Zod schemas
 * - Full TypeScript support with strict type checking
 *
 * @example
 * ```typescript
 * import { EvrimaRCON } from 'isle-evrima-rcon';
 *
 * const client = new EvrimaRCON('192.168.1.100', 8888, 'password', {
 *   autoReconnect: true,
 *   name: 'main-server'
 * });
 *
 * await client.connect();
 * await client.announce('Hello world!');
 * ```
 *
 * @module isle-evrima-rcon
 * @author MENIX (https://github.com/menix1337)
 * @license MIT
 */

/** Library version */
export const VERSION = '1.0.0';

// Main client exports
export { EvrimaRCON, rcon } from './client.js';
export type { CommandInput, BanParams, KickParams, DirectMessageParams, AiDensity } from './client.js';

// Type exports
export type {
	Command,
	ServerConfig,
	ClientOptions,
	CommandResult,
	ConnectionState,
	ClientEvents,
	PlayerInfo,
	PlayerData,
	ServerDetails,
	CommandDefinition,
	RCONErrorCode,
} from './types.js';

export { RCONError } from './types.js';

// Command registry exports
export {
	CommandRegistry,
	getCommandCode,
	getCommandDefinition,
	isValidCommand,
	getAllCommands,
	getCommandsByCategory,
	ProtocolCodes,
} from './commands.js';

export type { CommandCategory, CommandCategories } from './commands.js';

// Protocol exports (for advanced usage)
export {
	Protocol,
	ProtocolSocket,
	createAuthPacket,
	createCommandPacket,
	parsePlayersResponse,
	parsePlayerDataResponse,
	parseServerDetailsResponse,
} from './protocol.js';

export type { ParsedPlayer, ParsedPlayerData } from './protocol.js';

// Validation exports
export {
	ServerConfigSchema,
	ClientOptionsSchema,
	SteamIdSchema,
	ToggleParamSchema,
	AiDensitySchema,
	validateServerConfig,
	safeValidateServerConfig,
	validateClientOptions,
	isValidSteamId,
	isValidToggle,
} from './validation.js';

// Re-export commonly used types with aliases for convenience
export type { ServerConfig as Host } from './types.js';

// Default export for convenience
export { EvrimaRCON as default } from './client.js';
