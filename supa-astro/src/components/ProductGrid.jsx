import { useState, useEffect } from 'react';
import { getStockLevel, calculateProfitMargin, formatIndianCurrency } from '../lib/formatters';

export default function ProductGrid({ items, filter, searchTerm }) {
  const [filteredItems, setFilteredItems] = useState([]);
  
  useEffect(() => {
    if (!items) return;
    
    const filtered = items.filter(item => {
      const matchesSearch = 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()));
      
      if (filter === 'all') return matchesSearch;
      
      const stockLevel = getStockLevel(item['stock on hand']);
      return stockLevel === filter && matchesSearch;
    });
    
    setFilteredItems(filtered);
  }, [items, filter, searchTerm]);
  
  if (!items || items.length === 0) {
    return (
      <div className="empty-state">
        <i className="fas fa-box-open"></i>
        <h3>No inventory data</h3>
        <p>There are no items in the inventory or we're having trouble connecting to the database.</p>
      </div>
    );
  }
  
  if (filteredItems.length === 0) {
    return (
      <div className="empty-state">
        <i className="fas fa-search"></i>
        <h3>No items found</h3>
        <p>Try adjusting your search or filter criteria to see items.</p>
      </div>
    );
  }
  
  return (
    <div className="inventory-grid">
      {filteredItems.map(item => (
        <ProductCard key={item.item_id} item={item} />
      ))}
    </div>
  );
}

function ProductCard({ item }) {
  const stockOnHand = parseInt(item['stock on hand'], 10) || 0;
  const stockLevel = getStockLevel(stockOnHand);
  const stockPercent = Math.min(stockOnHand / 100 * 100, 100);
  const sellingRate = parseFloat(item.rate) || 0;
  const purchaseRate = parseFloat(item['purchase rate']) || 0;
  const profitMargin = calculateProfitMargin(sellingRate, purchaseRate);
  const profitLevel = profitMargin > 30 ? 'high' : profitMargin > 15 ? 'medium' : 'low';
  
  return (
    <div className="product-card fade-in" id={`product-${item.item_id}`}>
      <div className="product-header">
        <div className="product-header-content">
          <div className="product-title">{item.name || 'Unnamed Product'}</div>
          <div className="product-sku">{item.sku || 'No SKU'}</div>
        </div>
        <div className={`status-indicator status-${stockLevel}`}>
          <div className={`stock-indicator stock-${stockLevel}`}></div>
          {stockLevel.charAt(0).toUpperCase() + stockLevel.slice(1)}
        </div>
      </div>
      <div className="product-body">
        <div>
          <div className="product-info">
            <div className="info-label">Selling Price</div>
            <div className="info-value price-highlight">Rs.{formatIndianCurrency(sellingRate)}</div>
          </div>
          <div className="product-info">
            <div className="info-label">Purchase Price</div>
            <div className="info-value">Rs.{formatIndianCurrency(purchaseRate)}</div>
          </div>
          <div className="product-info">
            <div className="info-label">Profit Margin</div>
            <div className="info-value">
              {profitMargin}%
              <span className={`profit-indicator profit-${profitLevel}`}>
                {profitLevel.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="product-info">
            <div className="info-label">Stock On Hand</div>
            <div className="info-value">{stockOnHand} units</div>
          </div>
        </div>
        <div className="stock-section">
          <div className="stock-bar">
            <div 
              className="stock-fill" 
              style={{
                width: `${stockPercent}%`, 
                backgroundColor: `var(--${stockLevel === 'low' ? 'danger' : stockLevel === 'medium' ? 'warning' : 'success'})`
              }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}