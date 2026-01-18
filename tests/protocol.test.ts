/**
 * @fileoverview Unit tests for protocol utilities.
 * @module isle-evrima-rcon/tests/protocol
 */

import { describe, test, expect } from 'bun:test';
import {
	Protocol,
	createAuthPacket,
	createCommandPacket,
	parsePlayersResponse,
	parseServerDetailsResponse,
} from '../src/protocol.js';
import { RCONError, RCONErrorCode } from '../src/types.js';

describe('Protocol Constants', () => {
	test('should have correct protocol values', () => {
		expect(Protocol.COMMAND_PREFIX).toBe(0x02);
		expect(Protocol.AUTH_PREFIX).toBe(0x01);
		expect(Protocol.TERMINATOR).toBe(0x00);
		expect(Protocol.ENCODING).toBe('latin1'); // latin1 supports full 0-255 byte range
		expect(Protocol.AUTH_SUCCESS).toBe('Password Accepted');
	});
});

describe('createAuthPacket', () => {
	test('should create valid auth packet', () => {
		const password = 'testpassword';
		const packet = createAuthPacket(password);

		expect(packet.charCodeAt(0)).toBe(Protocol.AUTH_PREFIX);
		expect(packet.slice(1, -1)).toBe(password);
		expect(packet.charCodeAt(packet.length - 1)).toBe(Protocol.TERMINATOR);
	});

	test('should handle empty password', () => {
		const packet = createAuthPacket('');

		expect(packet.charCodeAt(0)).toBe(Protocol.AUTH_PREFIX);
		expect(packet.length).toBe(2); // Prefix + terminator
		expect(packet.charCodeAt(1)).toBe(Protocol.TERMINATOR);
	});

	test('should handle special characters in password', () => {
		const password = 'p@$$w0rd!#$%';
		const packet = createAuthPacket(password);

		expect(packet.slice(1, -1)).toBe(password);
	});
});

describe('createCommandPacket', () => {
	test('should create valid command packet for announce', () => {
		const message = 'Hello World';
		const packet = createCommandPacket('announce', message);

		expect(packet.charCodeAt(0)).toBe(Protocol.COMMAND_PREFIX);
		expect(packet.charCodeAt(1)).toBe(0x10); // announce command code
		expect(packet.slice(2, -1)).toBe(message);
		expect(packet.charCodeAt(packet.length - 1)).toBe(Protocol.TERMINATOR);
	});

	test('should create valid command packet for players', () => {
		const packet = createCommandPacket('players');

		expect(packet.charCodeAt(0)).toBe(Protocol.COMMAND_PREFIX);
		expect(packet.charCodeAt(1)).toBe(0x40); // players command code
		expect(packet.slice(2, -1)).toBe('');
	});

	test('should create valid packet for ban command with params', () => {
		const params = '76561198012345678,cheating';
		const packet = createCommandPacket('ban', params);

		expect(packet.charCodeAt(0)).toBe(Protocol.COMMAND_PREFIX);
		expect(packet.charCodeAt(1)).toBe(0x20); // ban command code
		expect(packet.slice(2, -1)).toBe(params);
	});

	test('should throw for invalid command', () => {
		expect(() => createCommandPacket('invalidcommand' as any)).toThrow(RCONError);

		try {
			createCommandPacket('fake' as any);
		} catch (error) {
			expect(error).toBeInstanceOf(RCONError);
			expect((error as RCONError).code).toBe(RCONErrorCode.INVALID_COMMAND);
		}
	});
});

describe('parsePlayersResponse', () => {
	test('should parse player list with new grouped format', () => {
		// Real server format: PlayerList header, then SteamIds, Names, EOSIds on separate lines
		const response = `PlayerList
76561198012345678,76561198087654321,76561198011111111,
PlayerOne,PlayerTwo,AdminPlayer,
EOS001,EOS002,EOS003,`;

		const players = parsePlayersResponse(response);

		expect(players).toHaveLength(3);
		expect(players[0]!.steamId).toBe('76561198012345678');
		expect(players[0]!.name).toBe('PlayerOne');
		expect(players[0]!.eosId).toBe('EOS001');
		expect(players[1]!.steamId).toBe('76561198087654321');
		expect(players[1]!.name).toBe('PlayerTwo');
		expect(players[2]!.steamId).toBe('76561198011111111');
		expect(players[2]!.name).toBe('AdminPlayer');
	});

	test('should handle format without PlayerList header', () => {
		const response = `76561198012345678,76561198087654321,
TheDiamondRex,Heichukar,`;

		const players = parsePlayersResponse(response);

		expect(players).toHaveLength(2);
		expect(players[0]!.steamId).toBe('76561198012345678');
		expect(players[0]!.name).toBe('TheDiamondRex');
		expect(players[1]!.steamId).toBe('76561198087654321');
		expect(players[1]!.name).toBe('Heichukar');
	});

	test('should handle empty response', () => {
		const players = parsePlayersResponse('');
		expect(players).toHaveLength(0);
	});

	test('should handle PlayerList with no players', () => {
		const response = 'PlayerList';
		const players = parsePlayersResponse(response);
		expect(players).toHaveLength(0);
	});

	test('should handle missing EOS IDs gracefully', () => {
		const response = `PlayerList
76561198012345678,76561198087654321,
PlayerOne,PlayerTwo,`;

		const players = parsePlayersResponse(response);

		expect(players).toHaveLength(2);
		expect(players[0]!.eosId).toBeUndefined();
		expect(players[1]!.eosId).toBeUndefined();
	});

	test('should construct raw field from parsed data', () => {
		const response = `PlayerList
76561198012345678,
TestPlayer,
EOS123,`;

		const players = parsePlayersResponse(response);

		expect(players[0]!.raw).toBe('76561198012345678,TestPlayer,EOS123');
	});
});

describe('parseServerDetailsResponse', () => {
	test('should parse key:value pairs', () => {
		const response = 'name:Test Server,players:50/100,map:Isla Spiro';
		const details = parseServerDetailsResponse(response);

		expect(details['name']).toBe('Test Server');
		expect(details['players']).toBe('50/100');
		expect(details['map']).toBe('Isla Spiro');
	});

	test('should parse key=value pairs', () => {
		const response = 'name=Test Server\nplayers=50/100\nmap=Isla Spiro';
		const details = parseServerDetailsResponse(response);

		expect(details['name']).toBe('Test Server');
		expect(details['players']).toBe('50/100');
		expect(details['map']).toBe('Isla Spiro');
	});

	test('should preserve raw response', () => {
		const response = 'name:Test,version:1.0';
		const details = parseServerDetailsResponse(response);

		expect(details['raw']).toBe(response);
	});

	test('should handle empty response', () => {
		const details = parseServerDetailsResponse('');
		expect(details['raw']).toBe('');
	});
});
