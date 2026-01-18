/**
 * @fileoverview Unit tests for validation schemas.
 * @module isle-evrima-rcon/tests/validation
 */

import { describe, test, expect } from 'bun:test';
import {
	validateServerConfig,
	safeValidateServerConfig,
	validateClientOptions,
	isValidSteamId,
	isValidToggle,
} from '../src/validation.js';

describe('ServerConfigSchema', () => {
	test('should validate correct IPv4 addresses', () => {
		const validConfigs = [
			{ ip: '127.0.0.1', port: 8888, password: 'test' },
			{ ip: '192.168.1.1', port: 27015, password: 'secret' },
			{ ip: '10.0.0.1', port: 1, password: 'pass' },
			{ ip: '255.255.255.255', port: 65535, password: 'p' },
		];

		for (const config of validConfigs) {
			expect(() => validateServerConfig(config)).not.toThrow();
		}
	});

	test('should validate localhost hostname', () => {
		const config = { ip: 'localhost', port: 8888, password: 'test' };
		expect(() => validateServerConfig(config)).not.toThrow();
	});

	test('should reject invalid IP addresses', () => {
		// Note: 'abc.def.ghi.jkl' is a valid hostname format (like 'mail.example.org')
		const invalidIps = ['', '256.1.1.1', '1.1.1.1.1', '192.168.1', '192.168.1.', 'not valid', '123'];

		for (const ip of invalidIps) {
			const result = safeValidateServerConfig({ ip, port: 8888, password: 'test' });
			expect(result.success).toBe(false);
		}
	});

	test('should reject invalid ports', () => {
		const invalidPorts = [0, -1, 65536, 100000, NaN];

		for (const port of invalidPorts) {
			const result = safeValidateServerConfig({ ip: '127.0.0.1', port, password: 'test' });
			expect(result.success).toBe(false);
		}
	});

	test('should reject empty password', () => {
		const result = safeValidateServerConfig({ ip: '127.0.0.1', port: 8888, password: '' });
		expect(result.success).toBe(false);
	});
});

describe('ClientOptionsSchema', () => {
	test('should apply defaults for empty options', () => {
		const options = validateClientOptions({});

		expect(options.timeout).toBe(10000);
		expect(options.autoReconnect).toBe(false);
		expect(options.maxReconnectAttempts).toBe(3);
		expect(options.reconnectDelay).toBe(1000);
		expect(options.debug).toBe(false);
	});

	test('should accept valid custom options', () => {
		const customOptions = {
			timeout: 5000,
			autoReconnect: true,
			maxReconnectAttempts: 5,
			reconnectDelay: 2000,
			debug: true,
		};

		const options = validateClientOptions(customOptions);

		expect(options.timeout).toBe(5000);
		expect(options.autoReconnect).toBe(true);
		expect(options.maxReconnectAttempts).toBe(5);
		expect(options.reconnectDelay).toBe(2000);
		expect(options.debug).toBe(true);
	});

	test('should reject invalid timeout values', () => {
		expect(() => validateClientOptions({ timeout: 500 })).toThrow(); // Too low
		expect(() => validateClientOptions({ timeout: 100000 })).toThrow(); // Too high
	});

	test('should reject invalid reconnect attempts', () => {
		expect(() => validateClientOptions({ maxReconnectAttempts: 0 })).toThrow();
		expect(() => validateClientOptions({ maxReconnectAttempts: 20 })).toThrow();
	});
});

describe('isValidSteamId', () => {
	test('should validate correct Steam IDs', () => {
		const validIds = ['76561198012345678', '76561198000000000', '76561199999999999'];

		for (const id of validIds) {
			expect(isValidSteamId(id)).toBe(true);
		}
	});

	test('should reject invalid Steam IDs', () => {
		const invalidIds = [
			'',
			'7656119801234567', // 16 digits
			'765611980123456789', // 18 digits
			'abcdefghijklmnopq', // Letters
			'76561198012345a78', // Mixed
		];

		for (const id of invalidIds) {
			expect(isValidSteamId(id)).toBe(false);
		}
	});
});

describe('isValidToggle', () => {
	test('should accept valid toggle values', () => {
		expect(isValidToggle('0')).toBe(true);
		expect(isValidToggle('1')).toBe(true);
	});

	test('should reject invalid toggle values', () => {
		expect(isValidToggle('')).toBe(false);
		expect(isValidToggle('2')).toBe(false);
		expect(isValidToggle('true')).toBe(false);
		expect(isValidToggle('false')).toBe(false);
		expect(isValidToggle('on')).toBe(false);
		expect(isValidToggle('off')).toBe(false);
	});
});
