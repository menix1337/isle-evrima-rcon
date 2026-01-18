# isle-evrima-rcon

[![npm version](https://img.shields.io/npm/v/isle-evrima-rcon.svg)](https://www.npmjs.com/package/isle-evrima-rcon)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A high-performance, type-safe RCON client for **The Isle: Evrima** game servers.

Built for production use with automatic reconnection, exponential backoff, and multi-server support.

> **Note:** This library only supports The Isle: Evrima. Legacy does not have RCON support.

## Features

- 🚀 **High Performance** — Persistent connections, reusable for thousands of commands
- 🔄 **Auto-Reconnect** — Automatic reconnection with exponential backoff
- 🔒 **Type-Safe** — Full TypeScript support with strict type checking
- 🏢 **Multi-Server** — Manage multiple game servers with named instances
- ✅ **Validated** — Zod schemas for configuration validation
- 📦 **Zero Config** — Sensible defaults, works out of the box

## Installation

```bash
# npm
npm install isle-evrima-rcon

# bun
bun add isle-evrima-rcon

# yarn
yarn add isle-evrima-rcon

# pnpm
pnpm add isle-evrima-rcon
```

## Quick Start

### One-Shot Command

Use the `rcon()` helper for single commands — it handles the connection lifecycle automatically:

```typescript
import { rcon } from 'isle-evrima-rcon';

const result = await rcon({
  host: { ip: '192.168.1.100', port: 8888, password: 'your-password' },
  command: { name: 'players' }
});

console.log(result.data);
```

### Persistent Connection

For multiple commands, use `EvrimaRCON` to maintain a persistent connection:

```typescript
import { EvrimaRCON } from 'isle-evrima-rcon';

const client = new EvrimaRCON('192.168.1.100', 8888, 'your-password', {
  autoReconnect: true,
  name: 'main-server' // Shows in debug logs
});

await client.connect();

// Server announcements
await client.announce('Welcome to the server!');

// Player management
const players = await client.getPlayers();
console.log(`Online: ${players.length} players`);

await client.kick({ steamId: '76561197960419839', reason: 'AFK too long' });
await client.ban({ steamId: '76561197960419839', reason: 'Rule violation' });

// When done
client.disconnect();
```

### Multi-Server Management

Each `EvrimaRCON` instance is independent — manage multiple servers simultaneously:

```typescript
import { EvrimaRCON } from 'isle-evrima-rcon';

// Create separate clients for each server
const server1 = new EvrimaRCON('192.168.1.100', 8888, 'password1', {
  autoReconnect: true,
  name: 'US-West-1'
});

const server2 = new EvrimaRCON('192.168.1.101', 8888, 'password2', {
  autoReconnect: true,
  name: 'EU-Central-1'
});

// Connect to all servers
await Promise.all([server1.connect(), server2.connect()]);

// Each server operates independently
await server1.announce('US West maintenance in 10 minutes');
await server2.announce('EU Central server rules updated');

// Reconnection is handled per-server automatically
```

## Configuration

```typescript
const client = new EvrimaRCON(host, port, password, {
  // Connection timeout in milliseconds
  timeout: 10000,           // default: 10000 (10s)

  // Automatically reconnect if connection drops
  autoReconnect: true,      // default: false

  // Maximum reconnection attempts before giving up
  maxReconnectAttempts: 5,  // default: 3

  // Base delay between reconnect attempts (uses exponential backoff)
  // Actual delays: 1s → 2s → 4s → 8s → ... (capped at 30s)
  reconnectDelay: 1000,     // default: 1000 (1s)

  // Enable debug logging to console
  debug: true,              // default: false

  // Server name for log identification (useful for multi-server setups)
  name: 'my-server'         // default: "host:port"
});
```

### Connection Resilience

When `autoReconnect` is enabled:

1. **Automatic Recovery** — If the connection drops, the client automatically reconnects
2. **Exponential Backoff** — Retry delays increase progressively (1s → 2s → 4s → 8s...) to avoid overwhelming the server
3. **Command Retry** — Commands sent during a disconnect will auto-retry after reconnection
4. **Max Attempts** — After `maxReconnectAttempts` failures, errors are thrown for handling

## API Reference

### Server Management

| Method | Description |
|--------|-------------|
| `announce(message)` | Broadcast message to all players |
| `directMessage({ steamId, message })` | Send private message to a player |
| `getServerDetails()` | Get server info (returns `ServerDetails`) |
| `wipeCorpses()` | Clear all corpses from the map |
| `updatePlayables(config)` | Update playable dinosaur configuration |
| `save(name?)` | Save the world state |

### Player Management

| Method | Description |
|--------|-------------|
| `getPlayers()` | Get online players (returns `PlayerInfo[]`) |
| `getPlayerData(steamId?)` | Get detailed player data |
| `ban({ steamId, reason? })` | Ban a player |
| `kick({ steamId, reason? })` | Kick a player |

### Whitelist

| Method | Description |
|--------|-------------|
| `setWhitelist(enabled)` | Toggle whitelist on/off |
| `whitelistAdd(steamId)` | Add player to whitelist |
| `whitelistRemove(steamId)` | Remove player from whitelist |

### Game Settings

| Method | Description |
|--------|-------------|
| `setGlobalChat(enabled)` | Toggle global chat |
| `setHumans(enabled)` | Toggle human characters |

### AI Controls

| Method | Description |
|--------|-------------|
| `setAI(enabled)` | Toggle AI spawning |
| `disableAIClasses(classes)` | Disable specific AI types |
| `setAIDensity(0.0-1.0)` | Set AI spawn density |

### Low-Level Commands

| Method | Description |
|--------|-------------|
| `sendCommand(command, params?)` | Execute any RCON command |
| `batch(commands)` | Execute multiple commands in sequence |
| `custom(commandString)` | Send a custom command string |

### Batch Execution

Execute multiple commands efficiently:

```typescript
const results = await client.batch([
  { command: 'announce', params: 'Server restart in 5 minutes' },
  { command: 'save' },
  { command: 'announce', params: 'Save complete!' }
]);
```

## Error Handling

```typescript
import { EvrimaRCON, RCONError, RCONErrorCode } from 'isle-evrima-rcon';

try {
  await client.connect();
  await client.announce('Hello!');
} catch (error) {
  if (error instanceof RCONError) {
    switch (error.code) {
      case RCONErrorCode.CONNECTION_FAILED:
        console.error('Server unreachable:', error.message);
        break;
      case RCONErrorCode.AUTH_FAILED:
        console.error('Invalid RCON password');
        break;
      case RCONErrorCode.TIMEOUT:
        console.error('Connection timed out');
        break;
      case RCONErrorCode.NOT_CONNECTED:
        console.error('Client not connected');
        break;
      case RCONErrorCode.INVALID_COMMAND:
        console.error('Invalid command:', error.message);
        break;
    }
  }
}
```

## Validation Utilities

Built-in validators for Steam IDs and configuration:

```typescript
import { isValidSteamId, validateServerConfig, validateClientOptions } from 'isle-evrima-rcon';

// Validate Steam ID format
if (isValidSteamId('76561197960419839')) {
  await client.whitelistAdd('76561197960419839');
}

// Validate server config (throws on invalid)
const config = validateServerConfig({
  ip: '192.168.1.100',
  port: 8888,
  password: 'secret'
});

// Validate client options with defaults applied
const options = validateClientOptions({
  timeout: 5000,
  autoReconnect: true
});
```

## TypeScript Support

Full type definitions with strict checking:

```typescript
import type {
  Command,
  CommandResult,
  PlayerInfo,
  ServerDetails,
  ServerConfig,
  ClientOptions,
  BanParams,
  KickParams,
  DirectMessageParams,
  ConnectionState,
  RCONErrorCode
} from 'isle-evrima-rcon';

// All convenience methods are fully typed
const players: PlayerInfo[] = await client.getPlayers();
const details: ServerDetails = await client.getServerDetails();
```

## Requirements

- **Bun** >= 1.0.0 or **Node.js** >= 18.0.0
- **TypeScript** >= 5.0.0 (peer dependency)
- The Isle: Evrima server with RCON enabled

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## Credits

Originally inspired by [smultar-dev/evrima.rcon](https://github.com/smultar-dev/evrima.rcon).  
Refactored, extended, and maintained by [MENIX](https://github.com/menix1337).

## License

[MIT](LICENSE) © 2026 MENIX
