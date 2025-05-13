import { Redis } from '@upstash/redis';
import type { H3Event } from 'h3';

// Helper to initialize Redis client, potentially memoized for warm functions
let redis: Redis | null = null;
function getRedisClient(event: H3Event): Redis | null {
  if (redis) return redis;

  const config = useRuntimeConfig(event);
  const redisUrl = config.public.upstashRedisUrl as string | undefined;
  const redisToken = config.public.upstashRedisToken as string | undefined;

  if (!redisUrl || !redisToken) {
    console.error('[API Route] Upstash Redis URL or Token is missing or invalid.');
    return null;
  }

  redis = new Redis({ url: redisUrl, token: redisToken });
  return redis;
}

export default defineEventHandler(async (event) => {
  const redisClient = getRedisClient(event);

  if (!redisClient) {
    setResponseStatus(event, 500, 'Redis not configured on server');
    return { error: 'Redis not configured on server', items: null, stats: null, source: 'server-error' };
  }

  try {
    const pipeline = redisClient.pipeline();
    pipeline.get("cache:all_inventory_items");
    pipeline.get("cache:inventory_stats");
    const [cachedItemsResult, cachedStatsResult] = await pipeline.exec<[any | null, any | null]>();

    const items = cachedItemsResult || null; // Directly use the deserialized data
    const stats = cachedStatsResult || null;

    if (items || stats) {
      console.log(`[API Route] Fetched from Redis: ${items ? items.length : 'no'} items, stats ${stats ? 'found' : 'not found'}`);
      return { items, stats, error: null, source: 'redis-cache' };
    }

    console.log('[API Route] Cache miss in Redis.');
    return { items: null, stats: null, error: 'Cache miss', source: 'cache-miss' };

  } catch (error: any) {
    console.error('[API Route] Error fetching from Redis:', error.message);
    setResponseStatus(event, 500, 'Error fetching from Redis cache');
    return { error: 'Failed to fetch from Redis cache', items: null, stats: null, source: 'redis-error' };
  }
});