import { Redis } from '@upstash/redis';
import type { H3Event } from 'h3'; // For typing if needed

// Helper to initialize Redis client, potentially memoized for warm functions
let redis: Redis | null = null;
function getRedisClient(event: H3Event) {
  if (redis) return redis;
  const config = useRuntimeConfig(event); // Use event for server routes
  if (!config.public.upstashRedisUrl || !config.public.upstashRedisToken) {
    console.error('Upstash Redis URL or Token not configured for Nuxt server route.');
    return null;
  }
  redis = new Redis({
    url: config.public.upstashRedisUrl as string,
    token: config.public.upstashRedisToken as string,
  });
  return redis;
}

export default defineEventHandler(async (event) => {
  const redisClient = getRedisClient(event);

  if (!redisClient) {
    return { error: 'Redis not configured on server', items: null, stats: null, source: 'error' };
  }

  try {
    // Use pipeline for fewer round trips if fetching multiple keys
    const pipeline = redisClient.pipeline();
    pipeline.get<string>("cache:all_inventory_items");
    pipeline.get<string>("cache:inventory_stats");
    const [cachedItemsResult, cachedStatsResult] = await pipeline.exec<[string | null, string | null]>();

    const items = cachedItemsResult ? JSON.parse(cachedItemsResult) : null;
    const stats = cachedStatsResult ? JSON.parse(cachedStatsResult) : null;

    if (items || stats) {
      console.log(`[API Route] Fetched from Redis: ${items ? items.length : 'no'} items, stats ${stats ? 'found' : 'not found'}`);
      return { items, stats, error: null, source: 'redis-cache' };
    }
    console.log('[API Route] Cache miss in Redis.');
    return { items: null, stats: null, error: 'Cache miss', source: 'cache-miss' };

  } catch (error: any) {
    console.error('[API Route] Error fetching from Redis:', error.message);
    // Don't expose full error to client for security
    return { error: 'Failed to fetch from Redis cache', items: null, stats: null, source: 'error' };
  }
});