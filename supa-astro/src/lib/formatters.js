export function formatIndianCurrency(value) {
    const num = typeof value === 'number' ? value : parseFloat(value) || 0;
    
    const numStr = num.toFixed(2);
    
    const [whole, decimal] = numStr.split('.');
    
    let formattedWhole = '';
    if (whole.length > 3) {
      formattedWhole = whole.slice(0, whole.length - 3) + ',' + whole.slice(whole.length - 3);
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
  
  export function calculateProfitMargin(sellingPrice, purchasePrice) {
    const sp = parseFloat(sellingPrice) || 0;
    const pp = parseFloat(purchasePrice) || 0;
    
    if (isNaN(sp) || isNaN(pp) || sp === 0) return '0.00';
    
    const margin = ((sp - pp) / sp * 100);
    return margin.toFixed(2);
  }
  
  export function getStockLevel(stockQuantity) {
    const stock = parseInt(stockQuantity, 10) || 0;
    if (stock <= 10) return 'low';
    if (stock <= 30) return 'medium';
    return 'high';
  }
  