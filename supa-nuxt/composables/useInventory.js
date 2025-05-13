// composables/useInventory.js
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useSupabase } from './useSupabase';
import { useNotifications } from './useNotifications';
import { useFormatting } from './useFormatting'; // Import formatting composable

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
      return;
    }
    if (isoTimestampString) {
        try {
            const date = new Date(isoTimestampString);
            lastUpdated.value = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } catch (e) {
            console.warn("Could not parse lastUpdated timestamp:", isoTimestampString);
            lastUpdated.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
    } else {
        lastUpdated.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  };

  const fetchInventoryData = async (isRetry = false) => {
    isLoading.value = true;
    if (!isRetry) connectionError.value = null;
    console.log('Attempting to fetch inventory data...');

    // Skip Redis if we're retrying or if we've already loaded from Redis
    const skipRedis = isRetry || dataSourceLoaded.value.redis;
    let cacheUsed = false;

    if (!skipRedis) {
      try {
        console.log('Trying to fetch from Nuxt server API (/api/cached-inventory)...');
        const cacheApiResponse = await $fetch('/api/cached-inventory');

        if (cacheApiResponse && cacheApiResponse.source === 'redis-cache') {
          if (cacheApiResponse.items) {
            try {
              const newItems = cacheApiResponse.items.map(processRecord).filter(item => item !== null);
              inventoryItems.value = newItems;
              console.log(`Loaded ${inventoryItems.value.length} items from Redis cache via server.`);
              dataSourceLoaded.value.redis = true;
            } catch (parseError) {
              console.error('Error processing items from Redis cache:', parseError);
            }
          }
          if (cacheApiResponse.stats) {
            try {
              cachedStatsData.value = cacheApiResponse.stats;
              updateLastUpdatedTimestamp(cacheApiResponse.stats.cacheLastUpdated);
              console.log('Loaded stats from Redis cache via server:', cachedStatsData.value);
            } catch (parseError) {
              console.error('Error processing stats from Redis cache:', parseError);
            }
          }
          if (inventoryItems.value.length > 0 || cachedStatsData.value) {
            cacheUsed = true;
            if (!isRetry) {
              showNotification('Data Loaded', 'Fetched initial data from cache.', 'success');
            }
          }
        } else {
          console.log('Cache miss or error from /cached-inventory:', cacheApiResponse?.error);
        }
      } catch (err) {
        console.error('Error fetching from /cached-inventory:', err);
      }
    }

    // Skip Supabase fetch if we have data from Redis and this is not a retry
    // This prevents the immediate second load from Supabase when we have Redis data
    const skipSupabase = cacheUsed && !isRetry && !dataSourceLoaded.value.supabase;

    if (!skipSupabase) {
      if (!supabase) {
        connectionError.value = supabaseErrorFromComposable || 'Supabase client initialization failed.';
        isLoading.value = false;
        showNotification('Error', connectionError.value, 'error');
        return;
      }

      console.log('Fetching from Supabase...');
      try {
        const { data, error: fetchError } = await supabase.from('items').select('*');
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
  };

  const handleRealtimeChange = (payload) => {
    console.log('Supabase Real-time change:', payload);
    updateLastUpdatedTimestamp(); // Live update, so update timestamp
    cachedStatsData.value = null; // Invalidate cached stats as live data has changed

    const { eventType, new: newRecord, old: oldRecord } = payload;
    let processed;

    switch (eventType) {
      case 'INSERT':
        processed = processRecord(newRecord);
        if (processed) {
            const exists = inventoryItems.value.some(item => item.item_id === processed.item_id);
            if (!exists) {
                inventoryItems.value.push(processed);
                showNotification('Item Added', `${processed.name} added.`, 'info');
            } else {
                 console.log(`Item ${processed.item_id} already exists, likely duplicate event.`);
            }
        }
        break;
      case 'UPDATE':
        processed = processRecord(newRecord);
        if (processed) {
            const index = inventoryItems.value.findIndex(item => item.item_id === processed.item_id);
            if (index !== -1) {
                inventoryItems.value[index] = processed;
                // Optionally add pulse effect later via class binding
                showNotification('Item Updated', `${processed.name} updated.`, 'info');
            } else {
                 console.warn(`Received update for non-existent item ID: ${processed.item_id}`);
                 // Optionally fetch missing item or add it
                 inventoryItems.value.push(processed);
            }
        }
        break;
      case 'DELETE':
        // Supabase often sends primary keys in `old` for DELETE
        const idToDelete = oldRecord?.item_id;
        if (idToDelete) {
           const index = inventoryItems.value.findIndex(item => String(item.item_id) === String(idToDelete));
           if (index !== -1) {
             const deletedName = inventoryItems.value[index].name;
             inventoryItems.value.splice(index, 1);
             showNotification('Item Removed', `${deletedName} removed.`, 'info');
           } else {
              console.warn(`Received delete for non-existent item ID: ${idToDelete}`);
           }
         } else {
             console.error('Could not determine ID for DELETE event:', oldRecord);
         }
        break;
      default:
        console.log('Unknown Supabase event type:', eventType);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!supabase) {
      console.error("Supabase client not available for real-time subscription.");
      isConnectedToRealtime.value = false;
      return;
    }
    if (realtimeChannel) {
      console.log("Realtime channel already exists. Skipping setup.");
      return;
    }

    console.log('Setting up Supabase real-time subscription...');
    try {
      realtimeChannel = supabase
        .channel('items-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, handleRealtimeChange)
        .subscribe((status, err) => {
          console.log(`Supabase channel status: ${status}`);
          isConnectedToRealtime.value = status === 'SUBSCRIBED';

          if (status === 'SUBSCRIBED') {
            connectionError.value = null;
            
            // Only fetch from Supabase if:
            // 1. We haven't loaded from Supabase yet, AND
            // 2. We either don't have Redis data OR we're forcing a refresh
            if (!dataSourceLoaded.value.supabase && (inventoryItems.value.length === 0 || !dataSourceLoaded.value.redis)) {
              console.log('No prior data sources loaded, fetching Supabase data on Realtime connect');
              fetchInventoryData(false); // false to avoid notification
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
      console.error("Error setting up Supabase channel:", error);
      isConnectedToRealtime.value = false;
      connectionError.value = "Failed to setup real-time listener.";
      showNotification('Subscription Error', connectionError.value, 'error');
    }
  };

  const closeRealtimeSubscription = async () => {
    if (realtimeChannel && supabase) {
      console.log('Closing real-time subscription...');
      try {
          const status = await supabase.removeChannel(realtimeChannel);
          console.log('Channel removal status:', status);
          realtimeChannel = null;
          isConnectedToRealtime.value = false; // Explicitly set to false on cleanup
      } catch(error) {
          console.error("Error removing Supabase channel:", error);
      }
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
    await fetchInventoryData();
    if (!lastUpdated.value && inventoryItems.value.length > 0) {
      updateLastUpdatedTimestamp();
    }
    setupRealtimeSubscription();
  });

  onUnmounted(() => {
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