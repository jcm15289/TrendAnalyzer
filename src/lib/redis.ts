import { createClient, RedisClientType } from 'redis';

export type RedisClient = RedisClientType<any, any, any>;

// Use 250MB Redis DB (redis-14969)
const DEFAULT_REDIS_URL =
  'redis://default:3oXlvgRqAf5gGtWErDiLFlrBrMCAgTzO@redis-14969.c15.us-east-1-4.ec2.cloud.redislabs.com:14969';

let redisClient: RedisClient | null = null;
let isResolvingClient = false;

function resolveRedisUrl(): string | null {
  const candidates = [
    process.env.REDIS_URL,
    process.env.REDIS_CONNECTION_STRING,
    process.env.REDIS_TLS_URL,
    process.env.KV_URL,
    process.env.NEXT_PUBLIC_REDIS_URL,
  ];

  // Check environment variables first, but validate they point to OLD Redis
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed && (trimmed.startsWith('redis://') || trimmed.startsWith('rediss://'))) {
      // Prefer 250MB Redis (redis-14969)
      if (trimmed.includes('redis-14969') || trimmed.includes(':14969')) {
        console.log('🚦 Redis: Using 250MB Redis DB (redis-14969) from environment variable');
        return trimmed;
      }
      // If env var points to old 25MB Redis, warn but allow override
      if (trimmed.includes('redis-18997') || trimmed.includes(':18997')) {
        console.warn('🚦 Redis: ⚠️ Environment variable points to 25MB Redis (18997). Consider switching to 250MB Redis (14969).');
      }
      console.log('🚦 Redis: Using Redis URL from environment variable');
      return trimmed;
    }
  }

  // Always fall back to 250MB Redis (DEFAULT_REDIS_URL)
  if (DEFAULT_REDIS_URL) {
    console.log('🚦 Redis: Using 250MB Redis (redis-14969) - DEFAULT_REDIS_URL');
    return DEFAULT_REDIS_URL;
  }

  console.warn('🚦 Redis: No Redis URL configured. Set REDIS_URL or related env var.');
  return null;
}

export async function getRedisClient(): Promise<RedisClient | null> {
  if (redisClient?.isOpen) {
    console.log('🚦 Redis: Reusing existing open connection');
    return redisClient;
  }

  if (isResolvingClient) {
    console.log('🚦 Redis: Awaiting ongoing Redis connection attempt');
    // Wait briefly to allow the ongoing connection attempt to resolve
    await new Promise((resolve) => setTimeout(resolve, 250));
    return redisClient?.isOpen ? redisClient : null;
  }

  const redisUrl = resolveRedisUrl();
  if (!redisUrl) {
    console.error('🚦 Redis: Cannot create client without URL');
    return null;
  }

  console.log('🚦 Redis: Creating new client instance');
  isResolvingClient = true;

  try {
    const client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 5_000,
        reconnectStrategy: false,
      },
    }) as RedisClient;

    client.on('error', (error) => {
      console.error('🚦 Redis: Client error event', error);
    });

    console.log('🚦 Redis: Connecting...');

    const connectPromise = client.connect();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Redis connection timeout after 5s')), 5_000),
    );

    await Promise.race([connectPromise, timeoutPromise]);

    if (!client.isOpen) {
      console.error('🚦 Redis: Client failed to open after connect');
      await client.quit().catch(() => null);
      return null;
    }

    console.log('🚦 Redis: ✅ Connected successfully');
    redisClient = client;
    return redisClient;
  } catch (error) {
    console.error('🚦 Redis: ❌ Failed to connect', error);
    redisClient = null;
    return null;
  } finally {
    isResolvingClient = false;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (!redisClient) {
    return;
  }

  try {
    console.log('🚦 Redis: Disconnecting client');
    await redisClient.quit();
  } catch (error) {
    console.error('🚦 Redis: Failed to disconnect cleanly', error);
  } finally {
    redisClient = null;
  }
}
