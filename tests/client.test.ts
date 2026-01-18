/**
 * @fileoverview Unit tests for the RCON client.
 * @module isle-evrima-rcon/tests/client
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { EvrimaRCON, rcon } from '../src/client.js';
import { RCONError, RCONErrorCode } from '../src/types.js';
import { MockRCONServer, MockPlayers, MockServerDetails } from './mock-server.js';

const TEST_PORT = 18888;
const TEST_PASSWORD = 'test_password_123';

describe('EvrimaRCON Client', () => {
	let mockServer: MockRCONServer;

	beforeAll(async () => {
		mockServer = new MockRCONServer({
			port: TEST_PORT,
			password: TEST_PASSWORD,
		});
		await mockServer.start();
	});

	afterAll(async () => {
		await mockServer.stop();
	});

	beforeEach(() => {
		mockServer.clearLogs();
	});

	describe('Connection', () => {
		test('should connect successfully with correct credentials', async () => {
			const client = new EvrimaRCON('127.0.0.1', TEST_PORT, TEST_PASSWORD);
			const connected = await client.connect();

			expect(connected).toBe(true);
			expect(client.isConnected).toBe(true);

			client.disconnect();
		});

		test('should fail to connect with wrong password', async () => {
			const client = new EvrimaRCON('127.0.0.1', TEST_PORT, 'wrong_password');

			try {
				await client.connect();
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect(error).toBeInstanceOf(RCONError);
				expect((error as RCONError).code).toBe(RCONErrorCode.AUTH_FAILED);
			}

			client.disconnect();
		});

		test('should return true if already connected', async () => {
			const client = new EvrimaRCON('127.0.0.1', TEST_PORT, TEST_PASSWORD);

			await client.connect();
			const secondConnect = await client.connect();

			expect(secondConnect).toBe(true);

			client.disconnect();
		});

		test('should handle disconnect correctly', async () => {
			const client = new EvrimaRCON('127.0.0.1', TEST_PORT, TEST_PASSWORD);

			await client.connect();
			expect(client.isConnected).toBe(true);

			client.disconnect();
			expect(client.isConnected).toBe(false);
		});
	});

	describe('Commands', () => {
		let client: EvrimaRCON;

		beforeAll(async () => {
			client = new EvrimaRCON('127.0.0.1', TEST_PORT, TEST_PASSWORD);
			await client.connect();
		});

		afterAll(() => {
			client.disconnect();
		});

		test('should execute announce command', async () => {
			const message = 'Test announcement message';
			const result = await client.sendCommand('announce', message);

			expect(result.success).toBe(true);
			expect(result.raw).toContain('Announcement sent');
			expect(result.command).toBe('announce');
			expect(result.timestamp).toBeInstanceOf(Date);
		});

		test('should execute players command', async () => {
			const result = await client.sendCommand('players');

			expect(result.success).toBe(true);
			expect(result.raw).toContain(MockPlayers[0].steamId);
			expect(result.raw).toContain(MockPlayers[0].name);
		});

		test('should execute srv:details command', async () => {
			const result = await client.sendCommand('srv:details');

			expect(result.success).toBe(true);
			expect(result.raw).toContain(MockServerDetails.name);
			expect(result.raw).toContain(MockServerDetails.map);
		});

		test('should execute ban command', async () => {
			const steamId = '76561198012345678';
			const reason = 'test ban';
			const result = await client.sendCommand('ban', `${steamId},${reason}`);

			expect(result.success).toBe(true);
			expect(result.raw).toContain('banned');
		});

		test('should execute kick command', async () => {
			const steamId = '76561198012345678';
			const reason = 'test kick';
			const result = await client.sendCommand('kick', `${steamId},${reason}`);

			expect(result.success).toBe(true);
			expect(result.raw).toContain('kicked');
		});

		test('should execute save command', async () => {
			const result = await client.sendCommand('save');

			expect(result.success).toBe(true);
			expect(result.raw).toContain('saved');
		});

		test('should execute whitelist:toggle command', async () => {
			const enableResult = await client.sendCommand('whitelist:toggle', '1');
			expect(enableResult.success).toBe(true);
			expect(enableResult.raw).toContain('enabled');

			const disableResult = await client.sendCommand('whitelist:toggle', '0');
			expect(disableResult.success).toBe(true);
			expect(disableResult.raw).toContain('disabled');
		});

		test('should execute whitelist:add command', async () => {
			const steamId = '76561198012345678';
			const result = await client.sendCommand('whitelist:add', steamId);

			expect(result.success).toBe(true);
			expect(result.raw).toContain('Added to whitelist');
		});

		test('should execute ai:toggle command', async () => {
			const result = await client.sendCommand('ai:toggle', '1');

			expect(result.success).toBe(true);
			expect(result.raw).toContain('AI enabled');
		});

		test('should execute ai:density command', async () => {
			const result = await client.sendCommand('ai:density', '0.5');

			expect(result.success).toBe(true);
			expect(result.raw).toContain('0.5');
		});

		test('should execute entities:wipe:corpses command', async () => {
			const result = await client.sendCommand('entities:wipe:corpses');

			expect(result.success).toBe(true);
			expect(result.raw).toContain('Corpses cleared');
		});

		test('should handle multiple commands in sequence', async () => {
			const results = await client.batch([
				{ command: 'announce', params: 'First' },
				{ command: 'announce', params: 'Second' },
				{ command: 'players' },
			]);

			expect(results).toHaveLength(3);
			expect(results.every((r) => r.success)).toBe(true);
		});
	});

	describe('Error handling', () => {
		test('should throw when sending command without connection', async () => {
			const client = new EvrimaRCON('127.0.0.1', TEST_PORT, TEST_PASSWORD);

			try {
				await client.sendCommand('players');
				expect(true).toBe(false); // Should not reach here
			} catch (error) {
				expect(error).toBeInstanceOf(RCONError);
				expect((error as RCONError).code).toBe(RCONErrorCode.NOT_CONNECTED);
			}
		});
	});
});

describe('rcon() convenience function', () => {
	let mockServer: MockRCONServer;

	beforeAll(async () => {
		mockServer = new MockRCONServer({
			port: TEST_PORT + 1,
			password: TEST_PASSWORD,
		});
		await mockServer.start();
	});

	afterAll(async () => {
		await mockServer.stop();
	});

	test('should execute single command and disconnect', async () => {
		const result = await rcon({
			host: {
				ip: '127.0.0.1',
				port: TEST_PORT + 1,
				password: TEST_PASSWORD,
			},
			command: {
				name: 'players',
			},
		});

		expect(result.success).toBe(true);
		expect(result.raw).toContain(MockPlayers[0].steamId);
	});

	test('should execute command with params', async () => {
		const result = await rcon({
			host: {
				ip: '127.0.0.1',
				port: TEST_PORT + 1,
				password: TEST_PASSWORD,
			},
			command: {
				name: 'announce',
				params: 'Test message from rcon function',
			},
		});

		expect(result.success).toBe(true);
		expect(result.raw).toContain('Announcement sent');
	});
});
