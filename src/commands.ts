/**
 * @fileoverview Command registry and definitions for Isle Evrima RCON.
 * @module isle-evrima-rcon/commands
 */

import type { Command, CommandDefinition } from './types.js';

/**
 * Protocol byte codes for commands.
 */
export const ProtocolCodes = {
	AUTH: 0x01,
	COMMAND: 0x02,
} as const;

/**
 * Registry of all available RCON commands with their byte codes and metadata.
 *
 * Command codes based on latest Evrima RCON protocol.
 * Some commands may require specific game server versions.
 */
export const CommandRegistry: ReadonlyMap<Command, CommandDefinition> = new Map([
	// ============================================================================
	// Core Protocol Commands (0x01-0x02)
	// ============================================================================
	[
		'auth',
		{
			code: 0x01,
			description: 'Authenticate with the RCON server',
			requiresParams: true,
			example: 'password',
		},
	],
	[
		'command',
		{
			code: 0x02,
			description: 'Execute a raw command',
			requiresParams: true,
			example: 'any raw command',
		},
	],

	// ============================================================================
	// Server Management Commands (0x10-0x1F)
	// ============================================================================
	[
		'announce',
		{
			code: 0x10,
			description: 'Send a server-wide announcement to all players',
			requiresParams: true,
			example: 'Server will restart in 5 minutes',
		},
	],
	[
		'dm',
		{
			code: 0x11,
			description: 'Send a direct message to a specific player',
			requiresParams: true,
			example: 'steamId,Your message here',
		},
	],
	[
		'srv:details',
		{
			code: 0x12,
			description: 'Retrieve server information and configuration',
			requiresParams: false,
		},
	],
	[
		'entities:wipe:corpses',
		{
			code: 0x13,
			description: 'Remove all dead bodies/corpses from the map',
			requiresParams: false,
		},
	],
	[
		'getplayables',
		{
			code: 0x14,
			description: 'Get list of available playable dinosaurs/characters',
			requiresParams: false,
		},
	],
	[
		'updateplayables',
		{
			code: 0x15,
			description: 'Update the playable characters/dinosaurs configuration',
			requiresParams: true,
			example: 'dino1:enabled,dino2:disabled',
		},
	],
	[
		'migrations:toggle',
		{
			code: 0x19,
			description: 'Toggle dinosaur migrations on/off',
			requiresParams: true,
			example: '1 or 0',
		},
	],

	// ============================================================================
	// Player Management Commands (0x20-0x4F)
	// ============================================================================
	[
		'ban',
		{
			code: 0x20,
			description: 'Ban a player from the server',
			requiresParams: true,
			example: 'steamId,reason',
		},
	],
	[
		'growth:multiplier:toggle',
		{
			code: 0x21,
			description: 'Toggle growth multiplier feature on/off',
			requiresParams: true,
			example: '1 or 0',
		},
	],
	[
		'growth:multiplier:set',
		{
			code: 0x22,
			description: 'Set the growth multiplier value',
			requiresParams: true,
			example: '1.5',
		},
	],
	[
		'netupdate:toggle',
		{
			code: 0x23,
			description: 'Toggle network update distance checks',
			requiresParams: true,
			example: '1 or 0',
		},
	],
	[
		'kick',
		{
			code: 0x30,
			description: 'Kick a player from the server',
			requiresParams: true,
			example: 'steamId,reason',
		},
	],
	[
		'players',
		{
			code: 0x40,
			description: 'List all players on server (returns SteamId, Name, EOSId)',
			requiresParams: false,
		},
	],

	// ============================================================================
	// World Management Commands (0x50-0x7F)
	// ============================================================================
	[
		'save',
		{
			code: 0x50,
			description: 'Trigger a server save operation',
			requiresParams: false,
		},
	],
	[
		'pause',
		{
			code: 0x60,
			description: 'Pause or unpause the server',
			requiresParams: true,
			example: '1 or 0',
		},
	],
	[
		'custom',
		{
			code: 0x70,
			description: 'Execute a custom command (may not be functional)',
			requiresParams: true,
		},
	],
	[
		'playData',
		{
			code: 0x77,
			description:
				'Get detailed player data (mutations, prime status). Response has PlayerData/PlayerDataEnd markers.',
			requiresParams: false,
		},
	],

	// ============================================================================
	// Whitelist Commands (0x81-0x83)
	// ============================================================================
	[
		'whitelist:toggle',
		{
			code: 0x81,
			description: 'Enable or disable the server whitelist',
			requiresParams: true,
			example: '1 or 0',
		},
	],
	[
		'whitelist:add',
		{
			code: 0x82,
			description: 'Add a player to the whitelist by Steam ID',
			requiresParams: true,
			example: 'steamId',
		},
	],
	[
		'whitelist:remove',
		{
			code: 0x83,
			description: 'Remove a player from the whitelist by Steam ID',
			requiresParams: true,
			example: 'steamId',
		},
	],

	// ============================================================================
	// Game Feature Toggles (0x84-0x8F)
	// ============================================================================
	[
		'globalchat:toggle',
		{
			code: 0x84,
			description: 'Enable or disable global chat for all players',
			requiresParams: true,
			example: '1 or 0',
		},
	],
	[
		'humans:toggle',
		{
			code: 0x86,
			description: 'Enable or disable human characters',
			requiresParams: true,
			example: '1 or 0',
		},
	],

	// ============================================================================
	// AI Controls (0x90+)
	// ============================================================================
	[
		'ai:toggle',
		{
			code: 0x90,
			description: 'Enable or disable AI spawning on the server',
			requiresParams: true,
			example: '1 or 0',
		},
	],
	[
		'ai:classes:disable',
		{
			code: 0x91,
			description: 'Disable specific AI dinosaur classes',
			requiresParams: true,
			example: 'raptor,trex,stego',
		},
	],
	[
		'ai:density',
		{
			code: 0x92,
			description: 'Set the AI spawn density (0.0 to 1.0)',
			requiresParams: true,
			example: '0.5',
		},
	],
	[
		'queue:status',
		{
			code: 0x93,
			description: 'Get the current server queue status',
			requiresParams: false,
		},
	],
	[
		'ai:learning:toggle',
		{
			code: 0x94,
			description: 'Toggle AI learning behavior on/off (may only work on official servers)',
			requiresParams: true,
			example: '1 or 0',
		},
	],
]);

/**
 * Get the byte code for a command.
 * @param command - The command name
 * @returns The byte code or undefined if command not found
 */
export function getCommandCode(command: Command): number | undefined {
	return CommandRegistry.get(command)?.code;
}

/**
 * Get the full command definition.
 * @param command - The command name
 * @returns The command definition or undefined if not found
 */
export function getCommandDefinition(command: Command): CommandDefinition | undefined {
	return CommandRegistry.get(command);
}

/**
 * Check if a command exists in the registry.
 * @param command - The command name to check
 * @returns True if the command exists
 */
export function isValidCommand(command: string): command is Command {
	return CommandRegistry.has(command as Command);
}

/**
 * Get all available command names.
 * @returns Array of all command names
 */
export function getAllCommands(): Command[] {
	return Array.from(CommandRegistry.keys());
}

/**
 * Command category names.
 */
export type CommandCategory = 'core' | 'server' | 'player' | 'world' | 'whitelist' | 'features' | 'ai';

/**
 * Commands organized by category.
 */
export type CommandCategories = {
	[K in CommandCategory]: Command[];
};

/**
 * Get commands by category based on their byte code ranges.
 */
export function getCommandsByCategory(): CommandCategories {
	const categories: CommandCategories = {
		core: [],
		server: [],
		player: [],
		world: [],
		whitelist: [],
		features: [],
		ai: [],
	};

	for (const [command, definition] of CommandRegistry.entries()) {
		const code = definition.code;

		if (code <= 0x02) categories.core.push(command);
		else if (code >= 0x10 && code <= 0x1f) categories.server.push(command);
		else if (code >= 0x20 && code <= 0x4f) categories.player.push(command);
		else if (code >= 0x50 && code <= 0x7f) categories.world.push(command);
		else if (code >= 0x81 && code <= 0x83) categories.whitelist.push(command);
		else if (code >= 0x84 && code <= 0x8f) categories.features.push(command);
		else if (code >= 0x90) categories.ai.push(command);
	}

	return categories;
}
