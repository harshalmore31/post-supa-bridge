const SUPABASE_URL = "https://dlebjzecztdyvlmnpkio.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsZWJqemVjenRkeXZsbW5wa2lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2NzUzMjYsImV4cCI6MjA1NzI1MTMyNn0.juYgH2QhcR7mHDbUtNSLtupkAaSRbTXc-qJVdcrgzoc";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let inventoryItems = [];
let filteredItems = [];
let currentFilter = 'all';
let searchTerm = '';
let isConnected = false;

// DOM Elements
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

async function initApp() {
    try {
        updateConnectionStatus(false);
        await fetchInventoryData();
        setupRealtimeSubscription();
        setupEventListeners();
    } catch (error) {
        console.error('Error initializing app:', error);
        showNotification('Error', 'Failed to initialize the application. Please refresh the page.');
        updateConnectionStatus(false);
        showConnectionErrorUI();
    }
}
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
            inventoryItems = data.map(item => processRecord(item));
            isConnected = true;
            updateConnectionStatus(true);
        } else {
            console.log('No data returned from Supabase');
            throw new Error('No data returned from database');
        }
        console.log('Inventory items:', inventoryItems);
        updateInventoryUI();
        updateStats();
        loader.style.display = 'none';
        showNotification('Data Loaded', `${inventoryItems.length} items loaded successfully.`);
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
        isConnected = false;
        updateConnectionStatus(false);
        showConnectionErrorUI();
        loader.style.display = 'none';
    }
}
function showConnectionErrorUI() {
    inventoryGrid.innerHTML = `
        <div class="connection-error">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Connection Error</h3>
            <p>Unable to connect to the inventory database. Please check your connection and try again.</p>
            <button id="retry-connection" class="retry-btn">Retry Connection</button>
        </div>
    `;
    document.getElementById('retry-connection')?.addEventListener('click', () => {
        loader.style.display = 'block';
        fetchInventoryData();
    });
    totalProductsElement.textContent = '0';
    totalValueElement.textContent = '$0.00';
    lowStockElement.textContent = '0';
}
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

function handleRealtimeChange(payload) {
    console.log('Real-time change detected:', payload);
    if (!isConnected) return;
    updateLastUpdated();
    
    const { eventType, new: newRecord, old: oldRecord } = payload;
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
            console.log('Processing DELETE event:', oldRecord);
            handleDelete(oldRecord);
            break;
        default:
            console.log('Unknown event type:', eventType);
    }
}
function processRecord(record) {
    if (!record) return null;
    return {
        ...record,
        item_id: parseInt(record.item_id, 10) || 0,
        'stock on hand': parseInt(record['stock on hand'], 10) || 0,
        name: String(record.name || ''),
        sku: String(record.sku || '').replace(/[()]/g, ''),
        rate: parseFloat(String(record.rate || '0').replace(/[^0-9.]/g, '')) || 0,
        'purchase rate': parseFloat(String(record['purchase rate'] || '0').replace(/[^0-9.]/g, '')) || 0
    };
}
function handleInsert(newItem) {
    if (!isConnected || !newItem) return;
    inventoryItems.push(newItem);
    updateInventoryUI();
    updateStats();
    showNotification('Item Added', `${newItem.name} has been added to inventory.`);
}
function handleUpdate(updatedItem) {
    if (!isConnected || !updatedItem) return;
    const index = inventoryItems.findIndex(item => item.item_id === updatedItem.item_id);
    if (index !== -1) {
        inventoryItems[index] = updatedItem;
        const card = document.getElementById(`product-${updatedItem.item_id}`);
        if (card) {
            card.classList.add('update-pulse');
            setTimeout(() => {
                card.classList.remove('update-pulse');
            }, 1000);
        }
    }
    updateInventoryUI();
    updateStats();
    showNotification('Item Updated', `${updatedItem.name} has been updated.`);
}
function handleDelete(deletedItem) {
    if (!isConnected || !deletedItem) return;
    const itemId = parseInt(deletedItem.item_id, 10);
    inventoryItems = inventoryItems.filter(item => item.item_id !== itemId);
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
    updateStats();
    showNotification('Item Removed', `${deletedItem.name || 'Item'} has been removed from inventory.`);
}
function updateConnectionStatus(isConnected) {
    connectionStatus.className = 'dot ' + (isConnected ? '' : 'offline');
    statusText.textContent = isConnected ? 'Connected' : 'Disconnected';
}
function setupEventListeners() {
    searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value.toLowerCase();
        updateInventoryUI();
    });
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentFilter = button.getAttribute('data-filter');
            updateInventoryUI();
        });
    });
    document.getElementById('close-notification')?.addEventListener('click', closeNotification);
}
function updateInventoryUI() {
    console.log('Updating inventory UI with filter:', currentFilter, 'and search term:', searchTerm);
    if (!isConnected) {
        showConnectionErrorUI();
        return;
    }
    filteredItems = inventoryItems.filter(item => {
        const matchesSearch = 
            item.name.toLowerCase().includes(searchTerm) || 
            (item.sku && item.sku.toLowerCase().includes(searchTerm));
        
        if (currentFilter === 'all') return matchesSearch;
        
        const stockLevel = getStockLevel(item['stock on hand']);
        return stockLevel === currentFilter && matchesSearch;
    });
    console.log('Filtered items count:', filteredItems.length);
    inventoryGrid.innerHTML = '';
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
    
    filteredItems.forEach(item => {
        const card = createProductCard(item);
        inventoryGrid.appendChild(card);
    });
    
    console.log('UI updated with', filteredItems.length, 'items');
}
// ... (keep all your existing functions until createProductCard) ...

function createProductCard(item) {
    const stockOnHand = parseInt(item['stock on hand'], 10) || 0;
    const stockLevel = getStockLevel(stockOnHand);
    const stockPercent = Math.min(stockOnHand / 100 * 100, 100);
    const sellingRate = parseFloat(item.rate) || 0;
    const purchaseRate = parseFloat(item['purchase rate']) || 0;
    const profitMargin = calculateProfitMargin(sellingRate, purchaseRate);
    const profitLevel = profitMargin > 30 ? 'high' : profitMargin > 15 ? 'medium' : 'low';
    
    const card = document.createElement('div');
    card.className = 'product-card fade-in';
    card.id = `product-${item.item_id}`;
    
    card.innerHTML = `
        <div class="product-header">
            <div class="product-header-content">
                <div class="product-title">${item.name || 'Unnamed Product'}</div>
                <div class="product-sku">${item.sku || 'No SKU'}</div>
            </div>
            <div class="status-indicator status-${stockLevel}">
                <div class="stock-indicator stock-${stockLevel}"></div>
                ${stockLevel.charAt(0).toUpperCase() + stockLevel.slice(1)}
            </div>
        </div>
        <div class="product-body">
            <div>
                <div class="product-info">
                    <div class="info-label">Selling Price</div>
                    <div class="info-value price-highlight">Rs.${formatIndianCurrency(sellingRate)}</div>
                </div>
                <div class="product-info">
                    <div class="info-label">Purchase Price</div>
                    <div class="info-value">Rs.${formatIndianCurrency(purchaseRate)}</div>
                </div>
                <div class="product-info">
                    <div class="info-label">Profit Margin</div>
                    <div class="info-value">
                        ${profitMargin}%
                        <span class="profit-indicator profit-${profitLevel}">
                            ${profitLevel.toUpperCase()}
                        </span>
                    </div>
                </div>
                <div class="product-info">
                    <div class="info-label">Stock On Hand</div>
                    <div class="info-value">${stockOnHand} units</div>
                </div>
            </div>
            <div class="stock-section">
                <div class="stock-bar">
                    <div class="stock-fill" style="width: ${stockPercent}%; background-color: var(--${stockLevel === 'low' ? 'danger' : stockLevel === 'medium' ? 'warning' : 'success'})"></div>
                </div>
            </div>
        </div>
    `;
    
    return card;
}

function updateStats() {
    console.log('Updating statistics...');
    if (!isConnected) {
        totalProductsElement.textContent = '0';
        totalValueElement.textContent = 'Rs.0.00';
        lowStockElement.textContent = '0';
        return;
    }
    totalProductsElement.textContent = inventoryItems.length;
    const totalValue = inventoryItems.reduce((sum, item) => {
        const rate = parseFloat(item.rate) || 0;
        const stock = parseInt(item['stock on hand'], 10) || 0;
        return sum + (rate * stock);
    }, 0);
    totalValueElement.textContent = `Rs.${formatIndianCurrency(totalValue)}`;
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

function formatIndianCurrency(value) {
    const num = typeof value === 'number' ? value : parseFloat(value) || 0;
    
    const numStr = num.toFixed(2);
    
    const [whole, decimal] = numStr.split('.');
    
    let formattedWhole = '';
    if (whole.length > 3) {
        formattedWhole = whole.slice(0, whole.length - 3) + ',' + whole.slice(whole.length - 3)
        let i = formattedWhole.indexOf(',') - 2;
        while (i > 0) {
            formattedWhole = formattedWhole.slice(0, i) + ',' + formattedWhole.slice(i);
            i -= 2;
        }
    } else {
        formattedWhole = whole;
    }
    return `${formattedWhole}.${decimal}`;
}
function calculateProfitMargin(sellingPrice, purchasePrice) {
    const sp = parseFloat(sellingPrice) || 0;
    const pp = parseFloat(purchasePrice) || 0;
    
    if (isNaN(sp) || isNaN(pp) || sp === 0) return '0.00';
    
    const margin = ((sp - pp) / sp * 100);
    return margin.toFixed(2);
}
function getStockLevel(stockQuantity) {
    const stock = parseInt(stockQuantity, 10) || 0;
    if (stock <= 10) return 'low';
    if (stock <= 30) return 'medium';
    return 'high';
}
function updateLastUpdated() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    lastUpdatedElement.textContent = timeString;
}
function showNotification(title, message) {
    const notification = document.getElementById('notification');
    const notificationTitle = document.getElementById('notification-title');
    const notificationMessage = document.getElementById('notification-message');
    
    notificationTitle.textContent = title;
    notificationMessage.textContent = message;
    
    notification.classList.add('show');
    
    setTimeout(() => {
        closeNotification();
    }, 5000);
}
function closeNotification() {
    const notification = document.getElementById('notification');
    notification.classList.remove('show');
}
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM content loaded, starting application...');
    initApp();
});
   