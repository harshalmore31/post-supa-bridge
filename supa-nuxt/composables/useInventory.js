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

    let cacheUsed = false;

    try {
      console.log('Trying to fetch from Nuxt server API (/api/cached-inventory)...');
      const cacheApiResponse = await $fetch('/api/cached-inventory');

      if (cacheApiResponse && cacheApiResponse.source === 'redis-cache') {
        if (cacheApiResponse.items) {
          try {
            inventoryItems.value = cacheApiResponse.items.map(processRecord).filter(item => item !== null);
            console.log(`Loaded ${inventoryItems.value.length} items from Redis cache via server.`);
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
          showNotification('Data Loaded', 'Fetched initial data from cache.', 'success');
        }
      } else {
        console.log('Cache miss or error from /cached-inventory:', cacheApiResponse?.error);
      }
    } catch (err) {
      console.error('Error fetching from /cached-inventory:', err);
    }

    if (!supabase) {
      connectionError.value = supabaseErrorFromComposable || 'Supabase client initialization failed.';
      isLoading.value = false;
      showNotification('Error', connectionError.value, 'error');
      return;
    }

    if (!cacheUsed || inventoryItems.value.length === 0 || isRetry) {
      console.log('Fetching from Supabase...');
      try {
        const { data, error: fetchError } = await supabase.from('items').select('*');
        if (fetchError) throw fetchError;

        if (data) {
          inventoryItems.value = data.map(processRecord).filter(item => item !== null);
          if (!cacheUsed || isRetry) {
            showNotification('Data Loaded', `${inventoryItems.value.length} items loaded from Supabase.`, 'success');
          }
          updateLastUpdatedTimestamp();
          cachedStatsData.value = null;
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
        const idToDelete = parseInt(oldRecord?.item_id, 10);
         if (!isNaN(idToDelete)) {
           const index = inventoryItems.value.findIndex(item => item.item_id === idToDelete);
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
            if (!isLoading.value) fetchInventoryData(true);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
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
    // If we have recently fetched stats from cache AND the item list reflects that cache, use cached stats.
    // This avoids re-computation until a live update comes in or a full refresh happens.
    if (cachedStatsData.value && inventoryItems.value.length === cachedStatsData.value.totalProducts) {
        console.log("Using stats from cachedStatsData");
        return { // Return in the consistent format expected by StatsContainer
            totalProducts: cachedStatsData.value.totalProducts,
            totalValue: cachedStatsData.value.totalValue,
            lowStockCount: cachedStatsData.value.lowStockCount,
        };
    }
    // Fall back to calculating from live inventoryItems
    console.log("Calculating stats locally from live inventoryItems");
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
    fetchInventoryData(true); // true to indicate it's a retry/refresh
    // Re-setup subscription if needed
    if (!realtimeChannel || realtimeChannel?.state !== 'joined') {
        closeRealtimeSubscription().then(setupRealtimeSubscription);
    }
  }

  // --- Lifecycle Hooks ---

  onMounted(async () => {
    await fetchInventoryData();
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