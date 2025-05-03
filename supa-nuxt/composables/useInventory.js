// composables/useInventory.js
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useSupabase } from './useSupabase';
import { useNotifications } from './useNotifications';
import { useFormatting } from './useFormatting'; // Import formatting composable

export const useInventory = () => {
  const { supabase, error: supabaseError } = useSupabase();
  const { showNotification } = useNotifications();
  const { parseCurrencyValue, getStockLevel } = useFormatting(); // Get needed functions

  const inventoryItems = ref([]);
  const isLoading = ref(true);
  const connectionError = ref(null);
  const isConnected = ref(false); // Real-time connection status
  const lastUpdated = ref('--');
  const searchTerm = ref('');
  const currentFilter = ref('all'); // 'all', 'low', 'medium', 'high'

  let realtimeChannel = null;

   // Process incoming records consistently
   const processRecord = (record) => {
     if (!record) return null;
     // Ensure all expected fields exist, providing defaults if necessary
     return {
         item_id: parseInt(record.item_id, 10) || Date.now(), // Use timestamp as fallback ID if missing
         name: String(record.name || 'Unknown Item'),
         sku: String(record.sku || 'N/A').replace(/[()]/g, ''), // Clean SKU
         // Use parseCurrencyValue for rates
         rate: parseCurrencyValue(record.rate),
         'purchase rate': parseCurrencyValue(record['purchase rate']),
         'stock on hand': parseInt(record['stock on hand'], 10) || 0,
     };
   };


  const fetchInventoryData = async () => {
    if (!supabase) {
      console.error("Supabase client not available in fetchInventoryData.");
      connectionError.value = supabaseError || 'Supabase client initialization failed.';
      isLoading.value = false;
      isConnected.value = false;
      showNotification('Error', connectionError.value, 'error');
      return;
    }

    isLoading.value = true;
    connectionError.value = null;
    console.log('Fetching inventory data...');

    try {
      const { data, error } = await supabase
        .from('items')
        .select('*');

      if (error) {
        console.error('Supabase fetch error:', error);
        throw error;
      }

      if (data) {
        console.log('Data received:', data.length);
        inventoryItems.value = data.map(processRecord).filter(item => item !== null); // Process and filter out nulls
        isConnected.value = true; // Assume connected if fetch succeeds before channel confirms
        showNotification('Data Loaded', `${inventoryItems.value.length} items loaded.`, 'success');
        updateLastUpdatedTimestamp();
      } else {
          inventoryItems.value = [];
          console.warn('No data returned from Supabase.');
          // Don't necessarily show an error, could be an empty table
      }
    } catch (err) {
      console.error('Error fetching inventory data:', err);
      connectionError.value = 'Could not fetch inventory data. ' + (err.message || '');
      inventoryItems.value = [];
      isConnected.value = false;
      showNotification('Fetch Error', connectionError.value, 'error');
    } finally {
      isLoading.value = false;
    }
  };

  const updateLastUpdatedTimestamp = () => {
      const now = new Date();
      lastUpdated.value = now.toLocaleTimeString();
  }

  const handleRealtimeChange = (payload) => {
    console.log('Real-time change:', payload);
    updateLastUpdatedTimestamp();

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
      isConnected.value = false;
      return;
    }
    if (realtimeChannel) {
         console.log("Realtime channel already exists. Skipping setup.");
         return;
    }

    console.log('Setting up real-time subscription...');
    try {
        realtimeChannel = supabase
          .channel('items-changes')
          .on('postgres_changes',
              { event: '*', schema: 'public', table: 'items' },
              handleRealtimeChange
          )
          .subscribe((status, err) => {
              console.log(`Supabase channel status: ${status}`);
              if (status === 'SUBSCRIBED') {
                  isConnected.value = true;
                  connectionError.value = null; // Clear previous errors on successful connection
                  console.log('Successfully connected to real-time updates.');
              } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                  isConnected.value = false;
                  connectionError.value = `Real-time connection error: ${status}`;
                  if(err) {
                      console.error("Subscription error details:", err);
                      connectionError.value += ` - ${err.message}`;
                  }
                   showNotification('Connection Issue', connectionError.value, 'error');
                  // Optional: Implement retry logic here
              } else if (status === 'CLOSED') {
                  isConnected.value = false;
                  console.log('Real-time channel closed.');
                  // Don't show error unless it was unexpected
              }
          });
         console.log('Realtime channel object:', realtimeChannel);

    } catch(error) {
         console.error("Error setting up Supabase channel:", error);
         isConnected.value = false;
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
          isConnected.value = false; // Explicitly set to false on cleanup
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
      const totalProducts = inventoryItems.value.length;
      const totalValue = inventoryItems.value.reduce((sum, item) => {
          const rate = item.rate || 0; // Already parsed number
          const stock = item['stock on hand'] || 0;
          return sum + (rate * stock);
      }, 0);
      const lowStockCount = inventoryItems.value.filter(item => getStockLevel(item['stock on hand']) === 'low').length;

      return {
          totalProducts,
          totalValue,
          lowStockCount,
      };
  });

  // --- Lifecycle Hooks ---

  onMounted(async () => {
    await fetchInventoryData();
    // Only setup subscription if fetch didn't fail catastrophically
    if (!connectionError.value || !connectionError.value.includes('initialization failed')) {
         setupRealtimeSubscription();
    }
  });

  onUnmounted(() => {
    closeRealtimeSubscription();
  });

  // --- Methods ---
   const retryConnection = () => {
      console.log("Retrying connection...");
      isLoading.value = true;
      connectionError.value = null;
      fetchInventoryData().then(() => {
          // Re-setup subscription if fetch succeeds and channel is not already active
         if (!connectionError.value && !realtimeChannel) {
              setupRealtimeSubscription();
         } else if (realtimeChannel?.state !== 'joined') {
             // If channel exists but isn't joined, try rejoining
             closeRealtimeSubscription().then(setupRealtimeSubscription);
         }
      });
   }

  // --- Exposed State and Methods ---
  return {
    inventoryItems, // Raw items
    filteredItems, // Items filtered by search/filter
    isLoading,
    connectionError,
    isConnected,
    lastUpdated,
    searchTerm,
    currentFilter,
    stats,
    retryConnection, // Expose retry method
    fetchInventoryData // Expose fetch for potential manual refresh
  };
};