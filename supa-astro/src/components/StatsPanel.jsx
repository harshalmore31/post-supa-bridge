import { useState, useEffect } from 'react';
import { formatIndianCurrency } from '../lib/formatters';

export default function StatsPanel({ items }) {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalValue: 0,
    lowStock: 0,
    lastUpdated: '--'
  });

  useEffect(() => {
    if (!items || items.length === 0) return;

    const totalProducts = items.length;
    
    const totalValue = items.reduce((sum, item) => {
      const rate = parseFloat(item.rate) || 0;
      const stock = parseInt(item['stock on hand'], 10) || 0;
      return sum + (rate * stock);
    }, 0);
    
    const lowStockCount = items.filter(item => {
      const stock = parseInt(item['stock on hand'], 10) || 0;
      return stock <= 10;
    }).length;
    
    const now = new Date();
    const timeString = now.toLocaleTimeString();

    setStats({
      totalProducts,
      totalValue,
      lowStock: lowStockCount,
      lastUpdated: timeString
    });
  }, [items]);

  return (
    <div className="stats-container">
      <div className="stat-card">
        <div className="stat-title">Total Products</div>
        <div className="stat-value" id="total-products">{stats.totalProducts}</div>
        <div className="stat-footer">
          <i className="fas fa-box"></i>
          <span>Items in inventory</span>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-title">Total Stock Value</div>
        <div className="stat-value" id="total-value">Rs.{formatIndianCurrency(stats.totalValue)}</div>
        <div className="stat-footer">
          <i className="fas fa-rupee-sign"></i>
          <span>Current value</span>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-title">Low Stock Items</div>
        <div className="stat-value" id="low-stock">{stats.lowStock}</div>
        <div className="stat-footer negative">
          <i className="fas fa-exclamation-triangle"></i>
          <span>Need attention</span>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-title">Last Updated</div>
        <div className="stat-value" id="last-updated">{stats.lastUpdated}</div>
        <div className="stat-footer">
          <i className="fas fa-sync-alt"></i>
          <span>Real-time sync</span>
        </div>
      </div>
    </div>
  );
}