/**
 * @fileoverview Unit tests for command registry and utilities.
 * @module isle-evrima-rcon/tests/commands
 */

import { describe, test, expect } from 'bun:test';
import {
	CommandRegistry,
	getCommandCode,
	getCommandDefinition,
	isValidCommand,
	getAllCommands,
	getCommandsByCategory,
} from '../src/commands.js';
import type { Command } from '../src/types.js';

describe('Command Registry', () => {
	test('should have all expected commands registered', () => {
		const expectedCommands: Command[] = [
			'auth',
			'command',
			'announce',
			'dm',
			'srv:details',
			'entities:wipe:corpses',
			'updateplayables',
			'ban',
			'kick',
			'players',
			'save',
			'custom',
			'playData',
			'whitelist:toggle',
			'whitelist:add',
			'whitelist:remove',
			'globalchat:toggle',
			'humans:toggle',
			'ai:toggle',
			'ai:classes:disable',
			'ai:density',
		];

		for (const cmd of expectedCommands) {
			expect(CommandRegistry.has(cmd)).toBe(true);
		}
	});

	test('should have unique byte codes for each command', () => {
		const codes = new Set<number>();

		for (const [_command, definition] of CommandRegistry.entries()) {
			expect(codes.has(definition.code)).toBe(false);
			codes.add(definition.code);
		}
	});

	test('each command should have required properties', () => {
		for (const [_command, definition] of CommandRegistry.entries()) {
			expect(typeof definition.code).toBe('number');
			expect(typeof definition.description).toBe('string');
			expect(definition.description.length).toBeGreaterThan(0);
			expect(typeof definition.requiresParams).toBe('boolean');
		}
	});
});

describe('getCommandCode', () => {
	test('should return correct code for valid commands', () => {
		expect(getCommandCode('auth')).toBe(0x01);
		expect(getCommandCode('command')).toBe(0x02);
		expect(getCommandCode('announce')).toBe(0x10);
		expect(getCommandCode('players')).toBe(0x40);
		expect(getCommandCode('ban')).toBe(0x20);
		expect(getCommandCode('kick')).toBe(0x30);
	});

	test('should return undefined for invalid commands', () => {
		expect(getCommandCode('invalid' as Command)).toBeUndefined();
		expect(getCommandCode('' as Command)).toBeUndefined();
	});
});

describe('getCommandDefinition', () => {
	test('should return full definition for valid commands', () => {
		const announceDef = getCommandDefinition('announce');

		expect(announceDef).toBeDefined();
		expect(announceDef!.code).toBe(0x10);
		expect(announceDef!.description).toContain('announcement');
		expect(announceDef!.requiresParams).toBe(true);
	});

	test('should return undefined for invalid commands', () => {
		expect(getCommandDefinition('fake' as Command)).toBeUndefined();
	});
});

describe('isValidCommand', () => {
	test('should return true for valid commands', () => {
		expect(isValidCommand('players')).toBe(true);
		expect(isValidCommand('announce')).toBe(true);
		expect(isValidCommand('ban')).toBe(true);
		expect(isValidCommand('kick')).toBe(true);
	});

	test('should return false for invalid commands', () => {
		expect(isValidCommand('notacommand')).toBe(false);
		expect(isValidCommand('')).toBe(false);
		expect(isValidCommand('PLAYERS')).toBe(false); // Case sensitive
	});
});

describe('getAllCommands', () => {
	test('should return array of all command names', () => {
		const commands = getAllCommands();

		expect(Array.isArray(commands)).toBe(true);
		expect(commands.length).toBe(CommandRegistry.size);
		expect(commands).toContain('players');
		expect(commands).toContain('announce');
	});
});

describe('getCommandsByCategory', () => {
	test('should return commands organized by category', () => {
		const categories = getCommandsByCategory();

		expect(categories.core).toContain('auth');
		expect(categories.core).toContain('command');

		expect(categories.server).toContain('announce');
		expect(categories.server).toContain('dm');
		expect(categories.server).toContain('srv:details');

		expect(categories.player).toContain('ban');
		expect(categories.player).toContain('kick');
		expect(categories.player).toContain('players');

		expect(categories.whitelist).toContain('whitelist:toggle');
		expect(categories.whitelist).toContain('whitelist:add');
		expect(categories.whitelist).toContain('whitelist:remove');

		expect(categories.ai).toContain('ai:toggle');
		expect(categories.ai).toContain('ai:density');
	});

	test('should have no overlapping commands between categories', () => {
		const categories = getCommandsByCategory();
		const allCommands: string[] = [];

		for (const commands of Object.values(categories)) {
			allCommands.push(...commands);
		}

		const uniqueCommands = new Set(allCommands);
		expect(uniqueCommands.size).toBe(allCommands.length);
	});
});
