// composables/useInventory.js
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useSupabase } from './useSupabase';
import { useNotifications } from './useNotifications';
import { useFormatting } from './useFormatting'; // Import formatting composable

// --- TIMING LOGS SETUP ---
const STORAGE_KEY = 'supa-nuxt-timing-logs';
const MAX_LOGS = 300; // Increased max logs for better history

// Initialize from sessionStorage if available
const initializeLogsFromStorage = () => {
  if (process.client) {
    try {
      const storedLogs = sessionStorage.getItem(STORAGE_KEY);
      if (storedLogs) {
        return JSON.parse(storedLogs);
      }
    } catch (e) {
      console.error('Error reading logs from sessionStorage:', e);
    }
  }
  return [];
};

export const timingLogs = ref(initializeLogsFromStorage());

// Generate a unique session ID
const generateSessionId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// Create or get existing session ID
const getSessionId = () => {
  if (process.client) {
    let sessionId = sessionStorage.getItem('supa-nuxt-session-id');
    if (!sessionId) {
      sessionId = generateSessionId();
      sessionStorage.setItem('supa-nuxt-session-id', sessionId);
    }
    return sessionId;
  }
  return 'server-session';
};

// Current session ID
const sessionId = getSessionId();

// Save logs to sessionStorage
const saveLogsToStorage = () => {
  if (process.client) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(timingLogs.value));
    } catch (e) {
      console.error('Error saving logs to sessionStorage:', e);
      // If storage is full, trim the logs and try again
      if (e.name === 'QuotaExceededError') {
        timingLogs.value = timingLogs.value.slice(0, Math.floor(timingLogs.value.length / 2));
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(timingLogs.value));
        } catch (e2) {
          console.error('Still unable to save logs after trimming:', e2);
        }
      }
    }
  }
};

// Performance measurement utilities
const performanceTimers = {};

const startPerformanceTimer = (operationId) => {
  performanceTimers[operationId] = performance.now();
  return performanceTimers[operationId];
};

const endPerformanceTimer = (operationId) => {
  if (!performanceTimers[operationId]) return 0;
  const duration = performance.now() - performanceTimers[operationId];
  delete performanceTimers[operationId]; // Cleanup
  return parseFloat(duration.toFixed(2));
};

// Create event groups for related events
const currentGroupId = ref(null);

const startEventGroup = (groupName) => {
  currentGroupId.value = `group_${groupName}_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  return currentGroupId.value;
};

const addTimingLog = (event, details = {}) => {
  const now = new Date();
  const logEntry = {
    timestamp: now.toISOString(),
    event,
    groupId: details.groupId || currentGroupId.value,
    sessionId,
    ...details,
  };

  timingLogs.value.unshift(logEntry);

  // Keep only the last N logs
  if (timingLogs.value.length > MAX_LOGS) {
    timingLogs.value = timingLogs.value.slice(0, MAX_LOGS);
  }

  // Save to session storage
  saveLogsToStorage();

  // For debugging the logs themselves:
  console.log('[TimingLog]', logEntry.event, details || '');
};

// Expose method to clear logs
export const clearTimingLogs = () => {
  timingLogs.value = [];
  if (process.client) {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Error clearing logs from sessionStorage:', e);
    }
  }
};
// --- END TIMING LOGS SETUP ---

export const useInventory = () => {
  const { supabase, error: supabaseErrorFromComposable } = useSupabase();
  const { showNotification } = useNotifications();
  const { parseCurrencyValue, getStockLevel } = useFormatting(); // Get needed functions

  const inventoryItems = ref([]);
  const isLoading = ref(true);
  const connectionError = ref(null);
  const isConnectedToRealtime = ref(false); // Specifically for Supabase Realtime
  const lastUpdated = ref('--');
  const searchTerm = ref('');
  const currentFilter = ref('all'); // 'all', 'low', 'medium', 'high'

  // Set the Cloudflare Worker URL
  const CLOUDFLARE_WORKER_URL = 'https://redis-cache.harshalmore2468.workers.dev';

  // To store stats potentially fetched from cache
  // This will be an object like { totalProducts: 0, totalValue: 0, lowStockCount: 0, cacheLastUpdated: "ISO_STRING" }
  const cachedStatsData = ref(null);

  // Track data sources that have been loaded already
  const dataSourceLoaded = ref({
    redis: false,
    supabase: false
  });

  let realtimeChannel = null;

  // Process incoming records consistently
  const processRecord = (record) => {
    if (!record) return null;
    return {
      item_id: String(record.item_id || Date.now().toString()), // Treat item_id as a string
      name: String(record.name || 'Unknown Item'),
      sku: String(record.sku || 'N/A').replace(/[()]/g, ''), // Clean SKU
      rate: parseCurrencyValue(record.rate),
      'purchase rate': parseCurrencyValue(record['purchase rate']),
      'stock on hand': parseInt(record['stock on hand'], 10) || 0,
    };
  };

  const updateLastUpdatedTimestamp = (isoTimestampString) => {
    if (process.server && !isoTimestampString) {
      lastUpdated.value = '--'; // Placeholder for SSR without cache
      addTimingLog('UpdateTimestampSSR', { value: '--' });
      return;
    }
    if (isoTimestampString) {
      try {
        const date = new Date(isoTimestampString);
        lastUpdated.value = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      } catch (e) {
        console.warn("Could not parse lastUpdated timestamp:", isoTimestampString, e);
        lastUpdated.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    } else {
      lastUpdated.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    addTimingLog('UpdateTimestamp', { value: lastUpdated.value, source: isoTimestampString ? 'cache' : 'live' });
  };

  const fetchInventoryData = async (isRetry = false) => {
    const groupId = startEventGroup('data-fetch');
    isLoading.value = true;
    if (!isRetry) connectionError.value = null;
    addTimingLog('FetchInventoryStart', { isRetry, groupId });
    console.log('Attempting to fetch inventory data...');

    // Skip Redis if we're retrying or if we've already loaded from Redis
    const skipRedis = isRetry || dataSourceLoaded.value.redis;
    let cacheUsed = false;
    let startTime, endTime, duration;

    if (!skipRedis) {
      startTime = performance.now();
      addTimingLog('CacheFetchAttempt', { source: CLOUDFLARE_WORKER_URL, groupId });
      try {
        console.log(`Trying to fetch from Cloudflare Worker (${CLOUDFLARE_WORKER_URL})...`);
        const cacheApiResponse = await $fetch(CLOUDFLARE_WORKER_URL);
        endTime = performance.now();
        duration = parseFloat((endTime - startTime).toFixed(2));

        addTimingLog('CacheFetchResult', {
          source: CLOUDFLARE_WORKER_URL,
          durationMs: duration,
          success: !cacheApiResponse.error && cacheApiResponse.source === 'redis-cache-cf-worker',
          cacheHit: cacheApiResponse.source === 'redis-cache-cf-worker',
          itemsCount: cacheApiResponse.items?.length,
          statsFound: !!cacheApiResponse.stats,
          error: cacheApiResponse.error,
          groupId
        });

        if (cacheApiResponse && cacheApiResponse.source === 'redis-cache-cf-worker') {
          if (cacheApiResponse.items) {
            try {
              const newItems = cacheApiResponse.items.map(processRecord).filter(item => item !== null);
              inventoryItems.value = newItems;
              console.log(`Loaded ${inventoryItems.value.length} items from Redis cache via Cloudflare Worker.`);
              dataSourceLoaded.value.redis = true;
            } catch (parseError) {
              console.error('Error processing items from Redis cache:', parseError);
              addTimingLog('CacheProcessError', { error: parseError.message || String(parseError), groupId });
            }
          }
          if (cacheApiResponse.stats) {
            try {
              cachedStatsData.value = cacheApiResponse.stats;
              updateLastUpdatedTimestamp(cacheApiResponse.stats.cacheLastUpdated);
              console.log('Loaded stats from Redis cache via Cloudflare Worker:', cachedStatsData.value);
            } catch (parseError) {
              console.error('Error processing stats from Redis cache:', parseError);
              addTimingLog('CacheStatsError', { error: parseError.message || String(parseError), groupId });
            }
          }
          if (inventoryItems.value.length > 0 || cachedStatsData.value) {
            cacheUsed = true;
            if (!isRetry) {
              showNotification('Data Loaded', 'Fetched initial data from cache.', 'success');
            }
          }
        } else {
          console.log('Cache miss or error from Cloudflare Worker:', cacheApiResponse?.error);
        }
      } catch (err) {
        endTime = performance.now();
        duration = parseFloat((endTime - startTime).toFixed(2));
        addTimingLog('CacheFetchError', {
          durationMs: duration,
          error: err.message || String(err),
          groupId
        });
        console.error('Error fetching from Cloudflare Worker:', err);
      }
    }

    // Skip Supabase fetch if we have data from Redis and this is not a retry
    // This prevents the immediate second load from Supabase when we have Redis data
    const skipSupabase = cacheUsed && !isRetry && !dataSourceLoaded.value.supabase;

    if (!skipSupabase) {
      if (!supabase) {
        connectionError.value = supabaseErrorFromComposable || 'Supabase client initialization failed.';
        isLoading.value = false;
        addTimingLog('SupabaseClientError', { error: connectionError.value, groupId });
        showNotification('Error', connectionError.value, 'error');
        return;
      }

      console.log('Fetching from Supabase...');
      startTime = performance.now();
      addTimingLog('SupabaseFetchAttempt', { groupId });
      try {
        const { data, error: fetchError } = await supabase.from('items').select('*');
        endTime = performance.now();
        duration = parseFloat((endTime - startTime).toFixed(2));

        addTimingLog('SupabaseFetchResult', {
          durationMs: duration,
          success: !fetchError,
          itemsCount: data?.length,
          error: fetchError?.message,
          groupId
        });

        if (fetchError) throw fetchError;

        if (data) {
          // If we already have Redis data and there are no differences, don't replace the items
          // This prevents the cards from "refreshing" unnecessarily
          const newItems = data.map(processRecord).filter(item => item !== null);
          const currentItemsJson = JSON.stringify(inventoryItems.value);
          const newItemsJson = JSON.stringify(newItems);

          if (currentItemsJson !== newItemsJson) {
            console.log('Updating items with Supabase data (different from current data)');
            inventoryItems.value = newItems;
            if (isRetry) {
              showNotification('Data Refreshed', `${inventoryItems.value.length} items loaded from Supabase.`, 'success');
            }
          } else {
            console.log('Supabase data matches current data, not refreshing UI');
          }

          updateLastUpdatedTimestamp();
          cachedStatsData.value = null;
          dataSourceLoaded.value.supabase = true;
        } else if (!cacheUsed) {
          inventoryItems.value = [];
        }
        connectionError.value = null;
      } catch (err) {
        endTime = performance.now();
        duration = parseFloat((endTime - startTime).toFixed(2));
        addTimingLog('SupabaseFetchError', {
          durationMs: duration,
          error: err.message || String(err),
          groupId
        });

        console.error('Error fetching from Supabase:', err);
        if (!cacheUsed) {
          connectionError.value = 'Could not fetch inventory data. ' + (err.message || '');
          inventoryItems.value = [];
          showNotification('Fetch Error', connectionError.value, 'error');
        } else {
          showNotification('Supabase Fallback Failed', 'Could not refresh from Supabase, using cached data.', 'warning');
        }
      }
    }

    isLoading.value = false;
    addTimingLog('FetchInventoryEnd', {
      cacheUsed,
      supabaseSkipped: skipSupabase,
      itemsCount: inventoryItems.value.length,
      groupId
    });
  };

  const handleRealtimeChange = (payload) => {
    console.log('Supabase Real-time change:', payload);

    // Start a new event group and performance timer for this realtime change
    const groupId = startEventGroup('realtime-update');
    const timerId = `realtime-${payload.eventType}-${Date.now()}`;
    startPerformanceTimer(timerId);

    // Log detailed information about the realtime change
    addTimingLog('SupabaseRealtimeEvent', {
      type: payload.eventType,
      table: payload.table,
      schema: payload.schema,
      itemId: String(payload.new?.item_id || payload.old?.item_id),
      timestamp: new Date().toISOString(),
      groupId
    });

    updateLastUpdatedTimestamp(); // Live update, so update timestamp
    cachedStatsData.value = null; // Invalidate cached stats as live data has changed

    const { eventType, new: newRecord, old: oldRecord } = payload;
    let processed;
    const startProcessTime = performance.now();

    switch (eventType) {
      case 'INSERT':
        processed = processRecord(newRecord);
        if (processed) {
          const exists = inventoryItems.value.some(item => item.item_id === processed.item_id);
          if (!exists) {
            const opStartTime = performance.now();
            inventoryItems.value.push(processed);
            const opEndTime = performance.now();

            showNotification('Item Added', `${processed.name} added.`, 'info');

            // Log the successful addition with item details and timing
            addTimingLog('ItemAdded', {
              itemId: processed.item_id,
              name: processed.name,
              stockLevel: processed['stock on hand'],
              durationMs: parseFloat((opEndTime - opStartTime).toFixed(2)),
              groupId
            });
          } else {
            console.log(`Item ${processed.item_id} already exists, likely duplicate event.`);
            addTimingLog('DuplicateItemIgnored', {
              itemId: processed.item_id,
              reason: 'Item already exists',
              groupId
            });
          }
        }
        break;
      case 'UPDATE':
        const updateStartTime = performance.now();
        processed = processRecord(newRecord);
        if (processed) {
          const index = inventoryItems.value.findIndex(item => item.item_id === processed.item_id);
          if (index !== -1) {
            // Calculate what changed
            const oldItem = inventoryItems.value[index];
            const changes = {};

            // Track specific fields that changed
            for (const key in processed) {
              if (JSON.stringify(oldItem[key]) !== JSON.stringify(processed[key])) {
                changes[key] = {
                  from: oldItem[key],
                  to: processed[key]
                };
              }
            }

            inventoryItems.value[index] = processed;
            const updateEndTime = performance.now();

            showNotification('Item Updated', `${processed.name} updated.`, 'info');

            // Log detailed information about what changed with timing
            addTimingLog('ItemUpdated', {
              itemId: processed.item_id,
              name: processed.name,
              changes,
              durationMs: parseFloat((updateEndTime - updateStartTime).toFixed(2)),
              groupId
            });
          } else {
            // Item doesn't exist, add it to inventory
            const addStartTime = performance.now();
            inventoryItems.value.push(processed);
            const addEndTime = performance.now();

            console.warn(`Received update for non-existent item ID: ${processed.item_id}`);

            addTimingLog('MissingItemAdded', {
              itemId: processed.item_id,
              name: processed.name,
              reason: 'Received update for non-existent item',
              durationMs: parseFloat((addEndTime - addStartTime).toFixed(2)),
              groupId
            });
          }
        }
        break;
      case 'DELETE':
        const deleteStartTime = performance.now();
        // Supabase often sends primary keys in `old` for DELETE
        const idToDelete = oldRecord?.item_id;
        if (idToDelete) {
          const index = inventoryItems.value.findIndex(item => String(item.item_id) === String(idToDelete));
          if (index !== -1) {
            const deletedName = inventoryItems.value[index].name;
            const deletedItem = { ...inventoryItems.value[index] };
            inventoryItems.value.splice(index, 1);
            const deleteEndTime = performance.now();

            showNotification('Item Removed', `${deletedName} removed.`, 'info');

            addTimingLog('ItemDeleted', {
              itemId: idToDelete,
              name: deletedName,
              deletedItem, // Log the full item for reference
              durationMs: parseFloat((deleteEndTime - deleteStartTime).toFixed(2)),
              groupId
            });
          } else {
            console.warn(`Received delete for non-existent item ID: ${idToDelete}`);
            addTimingLog('DeletedItemNotFound', {
              itemId: idToDelete,
              reason: 'Item not found in current inventory',
              groupId
            });
          }
        } else {
          console.error('Could not determine ID for DELETE event:', oldRecord);
          addTimingLog('DeleteEventError', {
            error: 'Could not determine ID for DELETE event',
            payload: oldRecord,
            groupId
          });
        }
        break;
      default:
        console.log('Unknown Supabase event type:', eventType);
        addTimingLog('UnknownRealtimeEvent', {
          eventType,
          payload,
          groupId
        });
    }

    // Calculate total processing time
    const endProcessTime = performance.now();
    const processingDuration = parseFloat((endProcessTime - startProcessTime).toFixed(2));

    // End the timer for the entire realtime operation
    const totalDuration = endPerformanceTimer(timerId);

    // Log the completion of realtime processing with timing
    addTimingLog('RealtimeProcessingComplete', {
      type: eventType,
      itemId: String(payload.new?.item_id || payload.old?.item_id),
      processingDurationMs: processingDuration, // Time spent just processing the data change
      durationMs: totalDuration, // Total time including everything
      timestamp: new Date().toISOString(),
      groupId
    });
  };

  // Enhanced realtime subscription setup with timing
  const setupRealtimeSubscription = () => {
    const setupTimerId = 'setup-realtime-' + Date.now();
    startPerformanceTimer(setupTimerId);
    addTimingLog('SupabaseRealtimeSetupAttempt');

    if (!supabase) {
      const duration = endPerformanceTimer(setupTimerId);
      addTimingLog('SupabaseRealtimeSetupFailed', {
        reason: 'Supabase client not available',
        durationMs: duration
      });
      isConnectedToRealtime.value = false;
      return;
    }

    if (realtimeChannel) {
      const duration = endPerformanceTimer(setupTimerId);
      addTimingLog('SupabaseRealtimeSetupSkipped', {
        reason: 'Channel already exists',
        durationMs: duration
      });
      console.log("Realtime channel already exists. Skipping setup.");
      return;
    }

    console.log('Setting up Supabase real-time subscription...');
    try {
      realtimeChannel = supabase
        .channel('items-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, handleRealtimeChange)
        .subscribe((status, err) => {
          const statusDuration = endPerformanceTimer(setupTimerId);
          console.log(`Supabase channel status: ${status}`);
          addTimingLog('SupabaseRealtimeStatus', {
            status,
            error: err?.message,
            connected: status === 'SUBSCRIBED',
            durationMs: statusDuration
          });

          isConnectedToRealtime.value = status === 'SUBSCRIBED';

          if (status === 'SUBSCRIBED') {
            connectionError.value = null;

            if (!dataSourceLoaded.value.supabase && (inventoryItems.value.length === 0 || !dataSourceLoaded.value.redis)) {
              console.log('No prior data sources loaded, fetching Supabase data on Realtime connect');
              addTimingLog('SupabaseFetchTriggerOnRTConnect');
              fetchInventoryData(false);
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            isConnectedToRealtime.value = false;
            if (!connectionError.value) {
              connectionError.value = `Real-time connection: ${status}`;
            }
            showNotification('Real-time Issue', `Real-time: ${status}${err ? ' - ' + err.message : ''}`, 'warning');
          } else if (status === 'CLOSED') {
            isConnectedToRealtime.value = false;
            console.log('Real-time channel closed.');
          }
        });
    } catch (error) {
      const duration = endPerformanceTimer(setupTimerId);
      console.error("Error setting up Supabase channel:", error);
      addTimingLog('SupabaseRealtimeSetupError', {
        error: error.message || String(error),
        durationMs: duration
      });
      isConnectedToRealtime.value = false;
      connectionError.value = "Failed to setup real-time listener.";
      showNotification('Subscription Error', connectionError.value, 'error');
    }
  };

  // Enhanced realtime subscription closure with timing
  const closeRealtimeSubscription = async () => {
    const closeTimerId = 'close-realtime-' + Date.now();
    startPerformanceTimer(closeTimerId);
    addTimingLog('SupabaseRealtimeCloseAttempt');

    if (realtimeChannel && supabase) {
      console.log('Closing real-time subscription...');
      try {
        const status = await supabase.removeChannel(realtimeChannel);
        const duration = endPerformanceTimer(closeTimerId);
        console.log('Channel removal status:', status);
        addTimingLog('SupabaseRealtimeCloseResult', {
          status,
          durationMs: duration
        });
        realtimeChannel = null;
        isConnectedToRealtime.value = false;
      } catch (error) {
        const duration = endPerformanceTimer(closeTimerId);
        addTimingLog('SupabaseRealtimeCloseError', {
          error: error.message || String(error),
          durationMs: duration
        });
        console.error("Error removing Supabase channel:", error);
      }
    } else {
      const duration = endPerformanceTimer(closeTimerId);
      addTimingLog('SupabaseRealtimeCloseSkipped', {
        reason: 'No active channel',
        durationMs: duration
      });
    }
  };

  // --- Computed Properties ---

  const filteredItems = computed(() => {
    if (!inventoryItems.value) return [];
    return inventoryItems.value.filter(item => {
      // Match search term (case-insensitive)
      const nameMatch = item.name?.toLowerCase().includes(searchTerm.value.toLowerCase());
      const skuMatch = item.sku?.toLowerCase().includes(searchTerm.value.toLowerCase());
      const matchesSearch = nameMatch || skuMatch;

      if (!matchesSearch) return false;

      // Match filter
      if (currentFilter.value === 'all') return true;

      const stockLevel = getStockLevel(item['stock on hand']);
      return stockLevel === currentFilter.value;
    });
  });

  const stats = computed(() => {
    if (cachedStatsData.value && inventoryItems.value.length === cachedStatsData.value.totalProducts) {
      console.log("Using stats from cachedStatsData.value", JSON.stringify(cachedStatsData.value));
      return {
        totalProducts: cachedStatsData.value.totalProducts,
        totalValue: cachedStatsData.value.totalValue,
        lowStockCount: cachedStatsData.value.lowStockCount,
      };
    }

    console.log("Calculating stats locally from live inventoryItems.value, length:", inventoryItems.value.length);
    if (!inventoryItems.value || inventoryItems.value.length === 0) {
      return { totalProducts: 0, totalValue: 0, lowStockCount: 0 };
    }

    const totalProducts = inventoryItems.value.length;
    const totalValue = inventoryItems.value.reduce((sum, item) => {
      const rate = item.rate || 0;
      const stock = item['stock on hand'] || 0;
      return sum + (rate * stock);
    }, 0);
    const lowStockCount = inventoryItems.value.filter(item => getStockLevel(item['stock on hand']) === 'low').length;

    return { totalProducts, totalValue, lowStockCount };
  });

  const retryConnection = () => {
    addTimingLog('RetryConnectionTriggered');
    console.log("Retrying connection (will try cache then Supabase)...");
    connectionError.value = null; // Clear critical error before retry

    // Force refresh from both sources
    dataSourceLoaded.value.redis = false;
    dataSourceLoaded.value.supabase = false;

    fetchInventoryData(true); // true to indicate it's a retry/refresh

    // Re-setup subscription if needed
    if (!realtimeChannel || realtimeChannel?.state !== 'joined') {
      closeRealtimeSubscription().then(setupRealtimeSubscription);
    }
  }

  // --- Lifecycle Hooks ---

  onMounted(async () => {
    addTimingLog('InventoryComposableMounted');
    const startTime = performance.now();
    await fetchInventoryData();
    const endTime = performance.now();
    const duration = parseFloat((endTime - startTime).toFixed(2));
    addTimingLog('InitialDataLoaded', {
      durationMs: duration,
      itemsCount: inventoryItems.value.length,
      cacheUsed: dataSourceLoaded.value.redis,
      supabaseUsed: dataSourceLoaded.value.supabase
    });

    if (!lastUpdated.value && inventoryItems.value.length > 0) {
      updateLastUpdatedTimestamp();
    }
    setupRealtimeSubscription();
  });

  onUnmounted(() => {
    addTimingLog('InventoryComposableUnmounted');
    closeRealtimeSubscription();
  });

  // --- Exposed State and Methods ---
  return {
    inventoryItems, // Raw items
    filteredItems, // Items filtered by search/filter
    isLoading,
    connectionError,
    isConnected: isConnectedToRealtime, // Expose the RT connection status
    lastUpdated,
    searchTerm,
    currentFilter,
    stats,
    retryConnection, // Expose retry method
    fetchInventoryData // Expose fetch for potential manual refresh
  };
};