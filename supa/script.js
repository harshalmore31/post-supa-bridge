
// Retrieve Supabase configuration from environment variables injected during build.
// Note: process.env is available when using a bundler like webpack/Vite.


const SUPABASE_URL = "https://dlebjzecztdyvlmnpkio.supabase.co"; // Set in your .env file
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsZWJqemVjenRkeXZsbW5wa2lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2NzUzMjYsImV4cCI6MjA1NzI1MTMyNn0.juYgH2QhcR7mHDbUtNSLtupkAaSRbTXc-qJVdcrgzoc"; // Public anon key for client usage only

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
console.log('Supabase client initialized:', supabase);

// Global state
let inventoryItems = [];
let filteredItems = [];
let currentFilter = 'all';
let searchTerm = '';
let isConnected = false;

// DOM elements
const inventoryGrid = document.getElementById('inventory-grid');
const loader = document.getElementById('loader');
const totalProductsElement = document.getElementById('total-products');
const totalValueElement = document.getElementById('total-value');
const lowStockElement = document.getElementById('low-stock');
const lastUpdatedElement = document.getElementById('last-updated');
const connectionStatus = document.getElementById('connection-status');
const statusText = document.getElementById('status-text');
const searchInput = document.getElementById('search-input');
const filterButtons = document.querySelectorAll('.filter-btn');

// Initialize the application
async function initApp() {
    try {
        console.log('Initializing app...');
        // Set initial UI state
        updateConnectionStatus(false);
        
        // Fetch initial data
        console.log('Fetching inventory data...');
        await fetchInventoryData();
        
        // Set up real-time subscription
        console.log('Setting up real-time subscription...');
        setupRealtimeSubscription();
        
        // Set up event listeners
        setupEventListeners();
        
        console.log('App initialization complete');
    } catch (error) {
        console.error('Error initializing app:', error);
        showNotification('Error', 'Failed to initialize the application. Please refresh the page.');
        updateConnectionStatus(false);
        showConnectionErrorUI();
    }
}

// Fetch inventory data from Supabase
async function fetchInventoryData() {
    try {
        console.log('Fetching data from Supabase...');
        
        const { data, error } = await supabase
            .from('items')
            .select('*');
        
        console.log('Supabase response:', { data, error });
        
        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }
        
        if (data && data.length > 0) {
            console.log('Data received from Supabase:', data);
            // Process data to ensure correct types
            inventoryItems = data.map(item => processRecord(item));
            isConnected = true;
            updateConnectionStatus(true);
        } else {
            console.log('No data returned from Supabase');
            throw new Error('No data returned from database');
        }
        
        console.log('Inventory items:', inventoryItems);
        
        // Update UI
        updateInventoryUI();
        updateStats();
        
        // Hide loader
        loader.style.display = 'none';
        
        // Show notification
        showNotification('Data Loaded', `${inventoryItems.length} items loaded successfully.`);
        
        // Update last updated time
        updateLastUpdated();
    } catch (error) {
        console.error('Error fetching inventory data:', error);
        console.log('Error details:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
        });
        
        showNotification('Connection Error', 'Could not connect to inventory database.');
        
        // Show connection error UI instead of sample data
        isConnected = false;
        updateConnectionStatus(false);
        showConnectionErrorUI();
        
        // Hide loader
        loader.style.display = 'none';
    }
}

// Show connection error UI message
function showConnectionErrorUI() {
    inventoryGrid.innerHTML = `
        <div class="connection-error">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Connection Error</h3>
            <p>Unable to connect to the inventory database. Please check your connection and try again.</p>
            <button id="retry-connection" class="retry-btn">Retry Connection</button>
        </div>
    `;
    
    // Add retry button event listener
    document.getElementById('retry-connection')?.addEventListener('click', () => {
        loader.style.display = 'block';
        fetchInventoryData();
    });
    
    // Clear stats when disconnected
    totalProductsElement.textContent = '0';
    totalValueElement.textContent = '$0.00';
    lowStockElement.textContent = '0';
}

// Set up real-time subscription with Supabase
function setupRealtimeSubscription() {
    try {
        console.log('Setting up Supabase channel');
        const channel = supabase
            .channel('items-changes')
            .on('postgres_changes', 
                {
                    event: '*',
                    schema: 'public',
                    table: 'items'
                }, 
                handleRealtimeChange
            )
            .subscribe((status) => {
                console.log('Subscription status:', status);
                const connected = status === 'SUBSCRIBED';
                updateConnectionStatus(connected);
                isConnected = connected;
            });
        
        console.log('Channel setup complete:', channel);
    } catch (error) {
        console.error('Error setting up realtime subscription:', error);
        updateConnectionStatus(false);
        isConnected = false;
    }
}

// Handle real-time changes from Supabase
function handleRealtimeChange(payload) {
    console.log('Real-time change detected:', payload);
    
    // Only process changes if we're connected
    if (!isConnected) return;
    
    // Update last updated time
    updateLastUpdated();
    
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    // Fix types for the real-time change payload
    let processedRecord;
    
    switch (eventType) {
        case 'INSERT':
            processedRecord = processRecord(newRecord);
            console.log('Processing INSERT event:', processedRecord);
            handleInsert(processedRecord);
            break;
        case 'UPDATE':
            processedRecord = processRecord(newRecord);
            console.log('Processing UPDATE event:', processedRecord);
            handleUpdate(processedRecord);
            break;
        case 'DELETE':
            // For delete, we only need the id
            console.log('Processing DELETE event:', oldRecord);
            handleDelete(oldRecord);
            break;
        default:
            console.log('Unknown event type:', eventType);
    }
}

// Process record to ensure correct data types
function processRecord(record) {
    if (!record) return null;
    return {
        ...record,
        item_id: parseInt(record.item_id, 10) || 0,
        'stock on hand': parseInt(record['stock on hand'], 10) || 0,
        name: String(record.name || ''),
        sku: String(record.sku || '').replace(/[()]/g, ''), // remove parentheses, e.g. (LP1001) -> LP1001
        // Parse the rate and purchase rate directly without extra division
        rate: parseFloat(String(record.rate || '0').replace(/[^0-9.]/g, '')) || 0,
        'purchase rate': parseFloat(String(record['purchase rate'] || '0').replace(/[^0-9.]/g, '')) || 0
    };
}

// Handle item insertion
function handleInsert(newItem) {
    if (!isConnected || !newItem) return;
    
    // Add new item to inventory
    inventoryItems.push(newItem);
    
    // Update UI
    updateInventoryUI();
    updateStats();
    
    // Show notification
    showNotification('Item Added', `${newItem.name} has been added to inventory.`);
}

// Handle item update
function handleUpdate(updatedItem) {
    if (!isConnected || !updatedItem) return;
    
    // Find and update the item
    const index = inventoryItems.findIndex(item => item.item_id === updatedItem.item_id);
    if (index !== -1) {
        inventoryItems[index] = updatedItem;
        
        // Highlight the updated card
        const card = document.getElementById(`product-${updatedItem.item_id}`);
        if (card) {
            card.classList.add('update-pulse');
            setTimeout(() => {
                card.classList.remove('update-pulse');
            }, 1000);
        }
    }
        
    // Update UI
    updateInventoryUI();
    updateStats();
    
    // Show notification
    showNotification('Item Updated', `${updatedItem.name} has been updated.`);
}

// Handle item deletion
function handleDelete(deletedItem) {
    if (!isConnected || !deletedItem) return;
    
    // Ensure item_id is an integer
    const itemId = parseInt(deletedItem.item_id, 10);
    
    // Remove the item from inventory
    inventoryItems = inventoryItems.filter(item => item.item_id !== itemId);
    
    // Find and remove the card with animation
    const card = document.getElementById(`product-${itemId}`);
    if (card) {
        card.style.opacity = '0';
        card.style.transform = 'scale(0.8)';
        setTimeout(() => {
            updateInventoryUI();
        }, 300);
    } else {
        updateInventoryUI();
    }
    
    // Update stats
    updateStats();
    
    // Show notification
    showNotification('Item Removed', `${deletedItem.name || 'Item'} has been removed from inventory.`);
}

// Update connection status UI
function updateConnectionStatus(isConnected) {
    connectionStatus.className = 'dot ' + (isConnected ? '' : 'offline');
    statusText.textContent = isConnected ? 'Connected' : 'Disconnected';
}

// Set up event listeners
function setupEventListeners() {
    // Search input
    searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value.toLowerCase();
        updateInventoryUI();
    });
    
    // Filter buttons
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update active button styling
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Apply filter
            currentFilter = button.getAttribute('data-filter');
            updateInventoryUI();
        });
    });
    
    // Close notification button
    document.getElementById('close-notification')?.addEventListener('click', closeNotification);
}

// Update the inventory UI based on current filters and search
function updateInventoryUI() {
    console.log('Updating inventory UI with filter:', currentFilter, 'and search term:', searchTerm);
    
    // If not connected, show error UI
    if (!isConnected) {
        showConnectionErrorUI();
        return;
    }
    
    // Apply filters and search
    filteredItems = inventoryItems.filter(item => {
        // Apply search filter
        const matchesSearch = 
            item.name.toLowerCase().includes(searchTerm) || 
            (item.sku && item.sku.toLowerCase().includes(searchTerm));
        
        // Apply stock level filter
        if (currentFilter === 'all') return matchesSearch;
        
        const stockLevel = getStockLevel(item['stock on hand']);
        return stockLevel === currentFilter && matchesSearch;
    });
    
    console.log('Filtered items count:', filteredItems.length);
    
    // Clear current items
    inventoryGrid.innerHTML = '';
    
    // Check if we have any items to display
    if (filteredItems.length === 0) {
        console.log('No items to display');
        inventoryGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <h3>No items found</h3>
                <p>Try adjusting your search or filter criteria to see items.</p>
            </div>
        `;
        return;
    }
    
    // Create product cards
    filteredItems.forEach(item => {
        const card = createProductCard(item);
        inventoryGrid.appendChild(card);
    });
    
    console.log('UI updated with', filteredItems.length, 'items');
}

// Create a product card element
// Updated processRecord function to properly handle INR values
function processRecord(record) {
    if (!record) return null;
    return {
        ...record,
        item_id: parseInt(record.item_id, 10) || 0,
        'stock on hand': parseInt(record['stock on hand'], 10) || 0,
        name: String(record.name || ''),
        sku: String(record.sku || '').replace(/[()]/g, ''), // remove parentheses, e.g. (LP1001) -> LP1001
        // Improved parsing for INR currency values
        rate: parseCurrencyValue(record.rate),
        'purchase rate': parseCurrencyValue(record['purchase rate'])
    };
}

// Function to properly parse INR currency values
function parseCurrencyValue(value) {
    if (!value) return 0;
    
    // Convert to string if it's not already
    const strValue = String(value);
    
    // Remove "Rs." prefix and any commas
    const numericString = strValue.replace(/Rs\.|,/g, '');
    
    // Parse as float
    return parseFloat(numericString) || 0;
}

// Updated createProductCard function with proper currency formatting
function createProductCard(item) {
    // Ensure correct types when creating cards
    const stockOnHand = parseInt(item['stock on hand'], 10) || 0;
    const stockLevel = getStockLevel(stockOnHand);
    const stockPercent = Math.min(stockOnHand / 100 * 100, 100); // Scale stock for visual bar
    
    // Properly parse rate values to avoid NaN
    const sellingRate = parseFloat(item.rate) || 0;
    const purchaseRate = parseFloat(item['purchase rate']) || 0;
    const profitMargin = calculateProfitMargin(sellingRate, purchaseRate);
    
    const card = document.createElement('div');
    card.className = 'product-card fade-in';
    card.id = `product-${item.item_id}`;
    
    card.innerHTML = `
        <div class="product-header">
            <div>
                <div class="product-title">${item.name || 'Unnamed Product'}</div>
                <div class="product-sku">SKU: ${item.sku || 'No SKU'}</div>
            </div>

        </div>
        <div class="product-body">
            <div class="product-info">
                <div class="info-label">Selling Price</div>
                <div class="info-value">Rs.${formatIndianCurrency(sellingRate)}</div>
            </div>
            <div class="product-info">
                <div class="info-label">Purchase Price</div>
                <div class="info-value">Rs.${formatIndianCurrency(purchaseRate)}</div>
            </div>
            <div class="product-info">
                <div class="info-label">Profit Margin</div>
                <div class="info-value">${profitMargin}%</div>
            </div>
            <div class="product-info">
                <div class="info-label">Stock</div>
                <div class="info-value">${stockOnHand} units</div>
            </div>
            <div class="stock-status">
                <div class="stock-indicator stock-${stockLevel}"></div>
                <span class="stock-${stockLevel}">${stockLevel.charAt(0).toUpperCase() + stockLevel.slice(1)} Stock</span>
            </div>
            <div class="stock-bar">
                <div class="stock-fill" style="width: ${stockPercent}%; background-color: var(--${stockLevel === 'low' ? 'danger' : stockLevel === 'medium' ? 'warning' : 'success'})"></div>
            </div>
        </div>
    `;
    
    return card;
}

// Updated updateStats function to properly format total value
function updateStats() {
    console.log('Updating statistics...');
    
    if (!isConnected) {
        totalProductsElement.textContent = '0';
        totalValueElement.textContent = 'Rs.0.00';
        lowStockElement.textContent = '0';
        return;
    }
    
    // Total products
    totalProductsElement.textContent = inventoryItems.length;
    
    // Total stock value
    const totalValue = inventoryItems.reduce((sum, item) => {
        // Ensure correct types for calculation
        const rate = parseFloat(item.rate) || 0;
        const stock = parseInt(item['stock on hand'], 10) || 0;
        return sum + (rate * stock);
    }, 0);
    totalValueElement.textContent = `Rs.${formatIndianCurrency(totalValue)}`;
    
    // Low stock items
    const lowStockCount = inventoryItems.filter(item => {
        const stock = parseInt(item['stock on hand'], 10) || 0;
        return getStockLevel(stock) === 'low';
    }).length;
    lowStockElement.textContent = lowStockCount;
    
    console.log('Statistics updated:', {
        totalProducts: inventoryItems.length,
        totalValue: formatIndianCurrency(totalValue),
        lowStockCount
    });
}

// New function to format numbers in Indian currency format (with commas)
function formatIndianCurrency(value) {
    // Ensure value is a number
    const num = typeof value === 'number' ? value : parseFloat(value) || 0;
    
    // Convert to string with 2 decimal places
    const numStr = num.toFixed(2);
    
    // Split into whole and decimal parts
    const [whole, decimal] = numStr.split('.');
    
    // Format whole part with commas for Indian number system
    // (Example: 1,00,000.00 instead of 100,000.00)
    let formattedWhole = '';
    
    // Handle first part (special case for Indian format)
    if (whole.length > 3) {
        formattedWhole = whole.slice(0, whole.length - 3) + ',' + whole.slice(whole.length - 3);
        
        // Now add commas every 2 digits for the leftmost part
        let i = formattedWhole.indexOf(',') - 2;
        while (i > 0) {
            formattedWhole = formattedWhole.slice(0, i) + ',' + formattedWhole.slice(i);
            i -= 2;
        }
    } else {
        formattedWhole = whole;
    }
    
    // Combine whole and decimal parts
    return `${formattedWhole}.${decimal}`;
}

// Calculate profit margin percentage
function calculateProfitMargin(sellingPrice, purchasePrice) {
    // Ensure we're working with numbers
    const sp = parseFloat(sellingPrice) || 0;
    const pp = parseFloat(purchasePrice) || 0;
    
    if (isNaN(sp) || isNaN(pp) || sp === 0) return '0.00';
    
    const margin = ((sp - pp) / sp * 100);
    return margin.toFixed(2);
}

// Determine stock level category
function getStockLevel(stockQuantity) {
    // Ensure stockQuantity is treated as a number
    const stock = parseInt(stockQuantity, 10) || 0;
    if (stock <= 10) return 'low';
    if (stock <= 30) return 'medium';
    return 'high';
}

// Update statistics section
// function updateStats() {
//     console.log('Updating statistics...');
    
//     if (!isConnected) {
//         totalProductsElement.textContent = '0';
//         totalValueElement.textContent = 'Rs.0.00';
//         lowStockElement.textContent = '0';
//         return;
//     }
    
//     // Total products
//     totalProductsElement.textContent = inventoryItems.length;
    
//     // Total stock value
//     const totalValue = inventoryItems.reduce((sum, item) => {
//         // Ensure correct types for calculation
//         const rate = parseFloat(item.rate) || 0;
//         const stock = parseInt(item['stock on hand'], 10) || 0;
//         return sum + (rate * stock);
//     }, 0);
//     totalValueElement.textContent = `Rs.${totalValue.toFixed(2)}`;
    
//     // Low stock items
//     const lowStockCount = inventoryItems.filter(item => {
//         const stock = parseInt(item['stock on hand'], 10) || 0;
//         return getStockLevel(stock) === 'low';
//     }).length;
//     lowStockElement.textContent = lowStockCount;
    
//     console.log('Statistics updated:', {
//         totalProducts: inventoryItems.length,
//         totalValue: totalValue.toFixed(2),
//         lowStockCount
//     });
// }

// Update last updated timestamp
function updateLastUpdated() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    lastUpdatedElement.textContent = timeString;
}

// Show notification
function showNotification(title, message) {
    const notification = document.getElementById('notification');
    const notificationTitle = document.getElementById('notification-title');
    const notificationMessage = document.getElementById('notification-message');
    
    notificationTitle.textContent = title;
    notificationMessage.textContent = message;
    
    notification.classList.add('show');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        closeNotification();
    }, 5000);
}

// Close notification
function closeNotification() {
    const notification = document.getElementById('notification');
    notification.classList.remove('show');
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM content loaded, starting application...');
    // Start the application
    initApp();
});
   