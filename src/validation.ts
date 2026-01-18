/**
 * @fileoverview Zod validation schemas for Isle Evrima RCON.
 * @module isle-evrima-rcon/validation
 */

import { z } from 'zod';
import type { ServerConfig, ClientOptions } from './types.js';

/**
 * IPv4 address regex pattern.
 */
const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;

/**
 * Hostname regex pattern (includes localhost and domain names).
 */
const HOSTNAME_REGEX = /^(?:localhost|(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z]{2,})$/;

/**
 * Steam ID regex pattern (17 digit number).
 */
const STEAM_ID_REGEX = /^\d{17}$/;

/**
 * Schema for validating server configuration.
 */
export const ServerConfigSchema = z.object({
	ip: z
		.string()
		.min(1, 'IP address or hostname is required')
		.refine((val: string) => IPV4_REGEX.test(val) || HOSTNAME_REGEX.test(val), {
			message: 'Must be a valid IPv4 address or hostname',
		}),
	port: z
		.number()
		.int('Port must be an integer')
		.min(1, 'Port must be at least 1')
		.max(65535, 'Port must be at most 65535'),
	password: z.string().min(1, 'Password is required'),
}) satisfies z.ZodType<ServerConfig>;

/**
 * Schema for validating client options.
 */
export const ClientOptionsSchema = z
	.object({
		timeout: z.number().int().min(1000).max(60000).optional().default(10000),
		autoReconnect: z.boolean().optional().default(false),
		maxReconnectAttempts: z.number().int().min(1).max(10).optional().default(3),
		reconnectDelay: z.number().int().min(100).max(30000).optional().default(1000),
		debug: z.boolean().optional().default(false),
		name: z.string().optional(),
	})
	.strict();

/**
 * Schema for validating Steam IDs.
 */
export const SteamIdSchema = z.string().regex(STEAM_ID_REGEX, 'Must be a valid 17-digit Steam ID');

/**
 * Schema for validating toggle parameters (0 or 1).
 */
export const ToggleParamSchema = z.enum(['0', '1'], {
	errorMap: () => ({ message: "Toggle value must be '0' or '1'" }),
});

/**
 * Schema for validating AI density (0.0 to 1.0).
 */
export const AiDensitySchema = z.string().refine(
	(val: string) => {
		const num = parseFloat(val);
		return !isNaN(num) && num >= 0 && num <= 1;
	},
	{ message: 'AI density must be a number between 0.0 and 1.0' }
);

/**
 * Validates server configuration.
 * @param config - Configuration to validate
 * @returns Validated configuration
 * @throws {z.ZodError} If validation fails
 */
export function validateServerConfig(config: unknown): ServerConfig {
	return ServerConfigSchema.parse(config);
}

/**
 * Safely validates server configuration without throwing.
 * @param config - Configuration to validate
 * @returns Result object with success flag and data/error
 */
export function safeValidateServerConfig(config: unknown): z.SafeParseReturnType<unknown, ServerConfig> {
	return ServerConfigSchema.safeParse(config);
}

/** Validated client options with defaults applied */
type ValidatedClientOptions = {
	timeout: number;
	autoReconnect: boolean;
	maxReconnectAttempts: number;
	reconnectDelay: number;
	debug: boolean;
	name: string | undefined;
};

/**
 * Validates client options with defaults applied.
 * @param options - Options to validate
 * @returns Validated options with defaults
 */
export function validateClientOptions(options?: unknown): ValidatedClientOptions {
	const parsed = ClientOptionsSchema.parse(options ?? {});
	return {
		timeout: parsed.timeout,
		autoReconnect: parsed.autoReconnect,
		maxReconnectAttempts: parsed.maxReconnectAttempts,
		reconnectDelay: parsed.reconnectDelay,
		debug: parsed.debug,
		name: parsed.name,
	};
}

/**
 * Validates a Steam ID.
 * @param steamId - Steam ID to validate
 * @returns True if valid
 */
export function isValidSteamId(steamId: string): boolean {
	return SteamIdSchema.safeParse(steamId).success;
}

/**
 * Validates toggle parameter.
 * @param value - Value to validate
 * @returns True if valid toggle value
 */
export function isValidToggle(value: string): value is '0' | '1' {
	return ToggleParamSchema.safeParse(value).success;
}

export type { ServerConfig, ClientOptions };
