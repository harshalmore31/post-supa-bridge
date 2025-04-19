import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import StatsPanel from './StatsPanel';
import ProductGrid from './ProductGrid';

export default function InventoryDashboard() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [currentFilter, setCurrentFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  useEffect(() => {
    fetchInventoryData();
    setupRealtimeSubscription();
    
    // Set up search input listener
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        setSearchTerm(e.target.value);
      });
    }
    
    // Set up filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
      button.addEventListener('click', () => {
        filterButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        setCurrentFilter(button.getAttribute('data-filter'));
      });
    });
    
    // Clean up event listeners
    return () => {
      if (searchInput) {
        searchInput.removeEventListener('input', (e) => {
          setSearchTerm(e.target.value);
        });
      }
    };
  }, []);
  
  async function fetchInventoryData() {
    try {
      setIsLoading(true);
      console.log('Fetching data from Supabase...');
      
      const { data, error } = await supabase
        .from('items')
        .select('*');
      
      if (error) {
        throw error;
      }
      
      if (data && data.length > 0) {
        setItems(data.map(item => processRecord(item)));
        setIsConnected(true);
        updateConnectionStatus(true);
        showNotification('Data Loaded', `${data.length} items loaded successfully.`);
      } else {
        throw new Error('No data returned from database');
      }
    } catch (error) {
      console.error('Error fetching inventory data:', error);
      showNotification('Connection Error', 'Could not connect to inventory database.');
      setIsConnected(false);
      updateConnectionStatus(false);
    } finally {
      setIsLoading(false);
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
          setIsConnected(connected);
        });
    } catch (error) {
      console.error('Error setting up realtime subscription:', error);
      updateConnectionStatus(false);
      setIsConnected(false);
    }
  }
  
  function handleRealtimeChange(payload) {
    console.log('Real-time change detected:', payload);
    const { eventType, new: newRecord, old: oldRecord } = payload;
    let processedRecord;
    
    switch (eventType) {
      case 'INSERT':
        processedRecord = processRecord(newRecord);
        if (processedRecord) {
          setItems(prevItems => [...prevItems, processedRecord]);
          showNotification('Item Added', `${processedRecord.name} has been added to inventory.`);
        }
        break;
      case 'UPDATE':
        processedRecord = processRecord(newRecord);
        if (processedRecord) {
          setItems(prevItems => prevItems.map(item => 
            item.item_id === processedRecord.item_id ? processedRecord : item
          ));
          showNotification('Item Updated', `${processedRecord.name} has been updated.`);
        }
        break;
      case 'DELETE':
        if (oldRecord) {
          const itemId = parseInt(oldRecord.item_id, 10);
          setItems(prevItems => prevItems.filter(item => item.item_id !== itemId));
          showNotification('Item Removed', `${oldRecord.name || 'Item'} has been removed from inventory.`);
        }
        break;
    }
  }
  
  function updateConnectionStatus(isConnected) {
    const connectionStatus = document.getElementById('connection-status');
    const statusText = document.getElementById('status-text');
    
    if (connectionStatus) {
      connectionStatus.className = 'dot ' + (isConnected ? '' : 'offline');
    }
    
    if (statusText) {
      statusText.textContent = isConnected ? 'Connected' : 'Disconnected';
    }
  }
  
  function showNotification(title, message) {
    const notification = document.getElementById('notification');
    const notificationTitle = document.getElementById('notification-title');
    const notificationMessage = document.getElementById('notification-message');
    
    if (notification && notificationTitle && notificationMessage) {
      notificationTitle.textContent = title;
      notificationMessage.textContent = message;
      notification.classList.add('show');
      
      setTimeout(() => {
        notification.classList.remove('show');
      }, 5000);
    }
  }
  
  return (
    <div className="inventory-dashboard">
      <StatsPanel items={items} />
      
      <div className="inventory-container">
        <div className="inventory-header">
          <h2 className="inventory-title">Product Inventory</h2>
          <div className="filter-options">
            <button className="filter-btn active" data-filter="all">All Items</button>
            <button className="filter-btn" data-filter="low">Low Stock</button>
            <button className="filter-btn" data-filter="medium">Medium Stock</button>
            <button className="filter-btn" data-filter="high">High Stock</button>
          </div>
        </div>

        <div id="inventory-content">
          {isLoading ? (
            <div className="loader-container">
              <div className="loading-spinner"></div>
              <div className="loader-text">Loading inventory data...</div>
            </div>
          ) : (
            <ProductGrid 
              items={items} 
              filter={currentFilter} 
              searchTerm={searchTerm} 
            />
          )}
        </div>
      </div>
    </div>
  );
}