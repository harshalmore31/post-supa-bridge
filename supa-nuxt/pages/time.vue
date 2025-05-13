<template>
  <div class="container timing-logs-page">
    <header>
      <div class="logo" @click="goHome" style="cursor: pointer;">
        <i class="fas fa-tachometer-alt"></i>
        <h1>Performance Logs</h1>
      </div>
      <div class="status-indicator">
        <span class="status-badge online">
          <i class="fas fa-circle"></i> All services online
        </span>
      </div>
      <div class="header-controls">
        <button @click="downloadLogs" class="download-btn">
          <i class="fas fa-download"></i> Download
        </button>
        <button @click="clearLogs" class="clear-logs-btn">
          <i class="fas fa-trash-alt"></i> Clear Logs
        </button>
      </div>
    </header>

    <div class="dashboard-layout">
      <div class="stats-section">
        <div class="stats-bar">
          <div class="stat-card">
            <div class="stat-label">Total Events</div>
            <div class="stat-value">{{ logs.length }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Data Load Avg</div>
            <div class="stat-value">{{ stats.avgDataLoadTime }} <span class="unit">ms</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Realtime Avg</div>
            <div class="stat-value">{{ stats.avgRealtimeTime }} <span class="unit">ms</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Session ID</div>
            <div class="stat-value session-id" :title="sessionId">{{ sessionId.substring(0, 8) }}...</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Events</div>
            <div class="stat-value stats-pills">
              <span class="stat-pill fetch" title="Data Fetch Operations">{{ stats.dataLoads }}</span>
              <span class="stat-pill realtime" title="Realtime Events">{{ stats.realtimeEvents }}</span>
              <span class="stat-pill error" title="Errors">{{ stats.errors }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="filters-section">
        <div class="filter-row">
          <div class="search-container">
            <i class="fas fa-search search-icon"></i>
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="Search logs..." 
              class="search-input"
            />
            <button 
              v-if="searchQuery" 
              @click="searchQuery = ''" 
              class="search-clear"
              title="Clear search"
            >
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <select v-model="eventTypeFilter" class="filter-select">
            <option value="all">All Event Types</option>
            <option value="fetch">Data Fetching</option>
            <option value="realtime">Realtime Updates</option>
            <option value="item">Item Changes</option>
            <option value="connection">Connection Events</option>
            <option value="error">Errors</option>
          </select>
          
          <button @click="refreshLogs" class="refresh-btn" title="Refresh logs">
            <i class="fas fa-sync-alt"></i> Refresh
          </button>
        </div>
        
        <div class="filter-options">
          <label class="option-toggle" title="Group related events together">
            <input type="checkbox" v-model="groupByEvent">
            <span class="toggle-label">Group Related Events</span>
          </label>
          
          <label class="option-toggle" title="Only show events with timing information">
            <input type="checkbox" v-model="showOnlyWithDuration">
            <span class="toggle-label">Show Only Timed Events</span>
          </label>
          
          <label class="option-toggle" title="Automatically expand all event groups">
            <input type="checkbox" v-model="autoExpandGroups">
            <span class="toggle-label">Auto-Expand Groups</span>
          </label>
        </div>
      </div>

      <p class="info-text">
        This dashboard shows timing and event logs for data fetching and real-time updates. The most recent events appear at the top.
      </p>

      <div v-if="filteredLogs.length === 0" class="empty-state">
        <i class="fas fa-clipboard-list empty-icon"></i>
        <p v-if="logs.length === 0">No logs yet. Navigate to the main inventory page and interact to generate logs.</p>
        <p v-else>No logs match your current filter criteria.</p>
      </div>

      <div v-else class="logs-container">
        <table>
          <thead>
            <tr>
              <th class="timestamp-col">Time</th>
              <th class="event-col">Event</th>
              <th class="duration-col">Duration</th>
              <th class="details-col">Details</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(group, groupIndex) in displayLogs">
              <tr 
                v-if="groupByEvent && group.isGroupHeader" 
                :key="`group-${groupIndex}`"
                class="group-header" 
                :class="getGroupClass(group)"
                @click="toggleGroup(group.groupId)"
              >
                <td class="timestamp-col">{{ formatTime(group.timestamp) }}</td>
                <td class="group-title" colspan="3">
                  <i :class="['fas', expandedGroups.includes(group.groupId) ? 'fa-chevron-down' : 'fa-chevron-right']"></i>
                  <span class="group-badge" :class="`group-${group.type}`">{{ group.type }}</span>
                  {{ group.title }} 
                  <span class="group-count">{{ group.count }} events</span>
                  <span v-if="getGroupDuration(group)" class="group-duration">{{ formatDuration(getGroupDuration(group)) }}</span>
                </td>
              </tr>
              
              <tr 
                v-for="(log, logIndex) in (groupByEvent ? (expandedGroups.includes(group.groupId) ? group.items : []) : [group])"
                :key="`${groupIndex}-${logIndex}`" 
                :class="[getRowClass(log), {'child-row': groupByEvent && group.isGroupHeader}]"
              >
                <td class="timestamp-col">{{ formatTime(log.timestamp) }}</td>
                <td class="event-col">
                  <span :class="getEventTypeClass(log.event)">{{ log.event }}</span>
                </td>
                <td class="duration-col">
                  <span v-if="log.durationMs !== undefined" :class="getDurationClass(log.durationMs)">
                    {{ formatDuration(log.durationMs) }}
                  </span>
                  <span v-else class="no-duration">-</span>
                </td>
                <td class="details-col" @click="toggleDetails(log)">
                  <div class="details-summary" :class="{ expanded: expandedDetails.includes(log) }">
                    {{ getDetailsSummary(log) }}
                    <i class="fas fa-angle-down expand-icon" v-if="hasDetails(log)"></i>
                  </div>
                  <pre v-if="expandedDetails.includes(log)" class="details-full">{{ formatDetails(log) }}</pre>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { timingLogs as globalTimingLogs, clearTimingLogs } from '~/composables/useInventory.js';

const router = useRouter();
const logs = computed(() => globalTimingLogs.value);
const sessionId = ref('');

// UI state
const expandedDetails = ref([]);
const expandedGroups = ref([]);
const searchQuery = ref('');
const eventTypeFilter = ref('all');
const groupByEvent = ref(true);
const showOnlyWithDuration = ref(false);
const autoExpandGroups = ref(false);

// Watch autoExpandGroups setting
watch(autoExpandGroups, (newVal) => {
  if (newVal && groupByEvent.value) {
    expandedGroups.value = displayLogs.value
      .filter(group => group.isGroupHeader)
      .map(group => group.groupId);
  }
});

// Get session ID from storage
onMounted(() => {
  if (process.client) {
    sessionId.value = sessionStorage.getItem('supa-nuxt-session-id') || 'Unknown';
  }
});

// Calculate session start time
const sessionStarted = computed(() => {
  if (logs.value.length === 0) return 'N/A';
  const oldestLog = [...logs.value].pop();
  return formatTime(oldestLog.timestamp);
});

// Generate statistics with improved timing metrics
const stats = computed(() => {
  return {
    dataLoads: logs.value.filter(log => 
      log.event === 'FetchInventoryStart'
    ).length,
    
    realtimeEvents: logs.value.filter(log => 
      log.event === 'SupabaseRealtimeEvent'
    ).length,
    
    errors: logs.value.filter(log => 
      log.error || log.success === false || 
      log.event.toLowerCase().includes('error')
    ).length,
    
    avgDataLoadTime: calculateAverageTime('InitialDataLoaded'),
    
    avgRealtimeTime: calculateAverageTime('RealtimeProcessingComplete')
  };
});

// Calculate average time for specific event types
function calculateAverageTime(eventType) {
  const relevantLogs = logs.value.filter(log => 
    log.event === eventType && log.durationMs !== undefined
  );
  
  if (relevantLogs.length === 0) return 0;
  
  const sum = relevantLogs.reduce((acc, log) => acc + log.durationMs, 0);
  return Math.round(sum / relevantLogs.length);
}

// Filter logs based on search, event type, and duration requirement
const filteredLogs = computed(() => {
  let filtered = logs.value;
  
  if (eventTypeFilter.value !== 'all') {
    filtered = filtered.filter(log => {
      const event = log.event.toLowerCase();
      switch(eventTypeFilter.value) {
        case 'fetch': 
          return event.includes('fetch') || event.includes('cache');
        case 'realtime': 
          return event.includes('realtime');
        case 'item': 
          return event.includes('item');
        case 'connection': 
          return event.includes('connect') || event.includes('status');
        case 'error': 
          return log.error || log.success === false || event.includes('error');
        default:
          return true;
      }
    });
  }
  
  if (showOnlyWithDuration.value) {
    filtered = filtered.filter(log => log.durationMs !== undefined);
  }
  
  if (searchQuery.value.trim()) {
    const search = searchQuery.value.toLowerCase();
    filtered = filtered.filter(log => {
      return log.event.toLowerCase().includes(search) || 
             JSON.stringify(log).toLowerCase().includes(search);
    });
  }
  
  return filtered;
});

// Group related logs with duration tracking
const displayLogs = computed(() => {
  if (!groupByEvent.value) {
    return filteredLogs.value;
  }
  
  const groups = {};
  filteredLogs.value.forEach(log => {
    const groupKey = log.groupId || `type_${log.event}`;
    
    if (!groups[groupKey]) {
      groups[groupKey] = {
        items: [],
        timestamp: log.timestamp,
        groupId: groupKey,
        hasDuration: false,
        maxDuration: 0
      };
    }
    
    if (log.durationMs !== undefined) {
      groups[groupKey].hasDuration = true;
      groups[groupKey].maxDuration = Math.max(groups[groupKey].maxDuration, log.durationMs);
    }
    
    groups[groupKey].items.push(log);
  });
  
  return Object.values(groups)
    .map(group => {
      const mainEvent = getMainEventFromGroup(group.items);
      return {
        ...group,
        isGroupHeader: true,
        title: getGroupTitle(mainEvent, group.items),
        count: group.items.length,
        type: getGroupType(mainEvent)
      };
    })
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
});

// Get the duration for a group (use the most significant duration)
function getGroupDuration(group) {
  if (!group.hasDuration) return null;
  
  const completionEvent = group.items.find(item => 
    item.event.includes('Complete') && item.durationMs !== undefined
  );
  if (completionEvent) return completionEvent.durationMs;
  
  return group.maxDuration > 0 ? group.maxDuration : null;
}

// Get styling for a group based on its type and content
function getGroupClass(group) {
  const classes = [];
  
  if (group.type === 'error' || group.items.some(item => item.error || item.success === false)) {
    classes.push('group-error');
  } else if (group.type === 'fetch') {
    classes.push('group-fetch');
  } else if (group.type === 'realtime') {
    classes.push('group-realtime');
  } else if (group.type === 'item') {
    classes.push('group-item');
  }
  
  return classes.join(' ');
}

function getMainEventFromGroup(items) {
  const eventPriority = {
    'FetchInventoryStart': 3,
    'SupabaseRealtimeEvent': 3,
    'ItemUpdated': 2,
    'ItemAdded': 2,
    'ItemDeleted': 2
  };
  
  return items.reduce((main, current) => {
    const mainPriority = eventPriority[main?.event] || 0;
    const currentPriority = eventPriority[current.event] || 0;
    return currentPriority > mainPriority ? current : main;
  }, items[0]);
}

function getGroupTitle(mainEvent, items) {
  if (!mainEvent) return 'Event Group';
  
  const event = mainEvent.event.toLowerCase();
  
  if (event.includes('fetch') || event.includes('cache')) {
    return 'Data Fetch Operation';
  } else if (event.includes('realtime')) {
    return `Realtime Update: ${mainEvent.type || 'Event'}`;
  } else if (event.includes('item')) {
    return `Item ${mainEvent.event.replace('Item', '')}: ${mainEvent.name || mainEvent.itemId}`;
  } else {
    return mainEvent.event;
  }
}

function getGroupType(mainEvent) {
  if (!mainEvent) return 'other';
  
  const event = mainEvent.event.toLowerCase();
  
  if (event.includes('fetch') || event.includes('cache')) {
    return 'fetch';
  } else if (event.includes('realtime')) {
    return 'realtime';
  } else if (event.includes('item')) {
    return 'item';
  } else if (event.includes('error')) {
    return 'error';
  } else {
    return 'other';
  }
}

function hasDetails(log) {
  const { timestamp, event, durationMs, groupId, sessionId, ...details } = log;
  return Object.keys(details).length > 0;
}

const formatTime = (isoString) => {
  if (!isoString) return '-';
  try {
    return new Date(isoString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit', 
      fractionalSecondDigits: 3 
    });
  } catch {
    return isoString;
  }
};

const formatDuration = (ms) => {
  if (!ms && ms !== 0) return '-';
  if (ms < 1) {
    return '<1ms';
  } else if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  } else {
    return `${(ms/1000).toFixed(2)}s`;
  }
};

const formatDetails = (log) => {
  const { timestamp, event, durationMs, groupId, sessionId, ...details } = log;
  return Object.keys(details).length > 0 ? JSON.stringify(details, null, 2) : '-';
};

const getDetailsSummary = (log) => {
  if (log.error) return `Error: ${log.error}`;
  if (log.itemId) {
    let summary = `Item ${log.itemId}`;
    if (log.name) summary += ` (${log.name})`;
    if (log.type) summary += ` - ${log.type}`;
    return summary;
  }
  if (log.success === false) return 'Failed';
  if (log.success === true) return 'Successful';
  if (log.status) return `Status: ${log.status}`;
  
  if (hasDetails(log)) return 'Click for details';
  return '-';
};

const toggleDetails = (log) => {
  const index = expandedDetails.value.indexOf(log);
  if (index === -1) {
    expandedDetails.value.push(log);
  } else {
    expandedDetails.value.splice(index, 1);
  }
};

const toggleGroup = (groupId) => {
  const index = expandedGroups.value.indexOf(groupId);
  if (index === -1) {
    expandedGroups.value.push(groupId);
  } else {
    expandedGroups.value.splice(index, 1);
  }
};

const refreshLogs = () => {
  const temp = [...logs.value];
  globalTimingLogs.value = temp;
};

const getRowClass = (log) => {
  const classes = [];
  
  if (log.error || log.success === false) {
    classes.push('log-error');
  } else if (log.event?.toLowerCase().includes('success') || log.success === true) {
    classes.push('log-success');
  } else if (log.event?.toLowerCase().includes('start') || log.event?.toLowerCase().includes('attempt')) {
    classes.push('log-start');
  } else if (log.event?.toLowerCase().includes('status')) {
    classes.push('log-status');
  }
  
  if (log.event?.toLowerCase().includes('item')) {
    classes.push('log-item');
  }
  
  return classes.join(' ');
};

const getEventTypeClass = (event) => {
  if (!event) return '';
  
  const eventLower = event.toLowerCase();
  
  if (eventLower.includes('fetch') || eventLower.includes('cache')) {
    return 'event-fetch';
  } else if (eventLower.includes('realtime')) {
    return 'event-realtime';
  } else if (eventLower.includes('item')) {
    return 'event-item';
  } else if (eventLower.includes('error')) {
    return 'event-error';
  } else {
    return 'event-other';
  }
};

const getDurationClass = (ms) => {
  if (!ms && ms !== 0) return '';
  if (ms < 50) return 'duration-fast';
  if (ms < 200) return 'duration-medium';
  return 'duration-slow';
};

const downloadLogs = () => {
  if (process.client && logs.value.length > 0) {
    const dataStr = JSON.stringify(logs.value, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileName = `supa-nuxt-logs-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileName);
    linkElement.click();
  }
};

const clearLogs = () => {
  clearTimingLogs();
  expandedDetails.value = [];
  expandedGroups.value = [];
};

const goHome = () => {
  router.push('/');
};

useHead({
  title: 'Performance & Timing Logs'
});
</script>

<style scoped>
.timing-logs-page {
  padding: 20px;
  font-family: 'Inter', sans-serif;
  max-width: 1200px;
  margin: 0 auto;
  color: #333;
}

/* Improved header */
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  transition: transform 0.2s;
}

.logo:hover {
  transform: translateY(-2px);
}

.logo i {
  font-size: 22px;
  color: #4f46e5;
}

.logo h1 {
  font-size: 24px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.status-indicator {
  margin-right: auto;
  margin-left: 24px;
}

.status-badge {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
}

.status-badge.online {
  background-color: #ecfdf5;
  color: #047857;
}

.status-badge.online i {
  color: #10b981;
  margin-right: 6px;
  font-size: 10px;
}

.header-controls {
  display: flex;
  gap: 10px;
}

.clear-logs-btn, .download-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.clear-logs-btn {
  background-color: #fee2e2;
  color: #b91c1c;
}

.download-btn {
  background-color: #e0f2fe;
  color: #0369a1;
}

.clear-logs-btn:hover {
  background-color: #fecaca;
}

.download-btn:hover {
  background-color: #bae6fd;
}

/* Dashboard layout */
.dashboard-layout {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Stats section */
.stats-section {
  margin-bottom: 10px;
}

.stats-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  background-color: #ffffff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  border: 1px solid #f0f0f0;
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.stat-label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 8px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  display: flex;
  align-items: center;
}

.unit {
  font-size: 12px;
  color: #6b7280;
  margin-left: 4px;
}

.session-id {
  font-size: 16px;
  font-family: monospace;
  background-color: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
}

.stats-pills {
  display: flex;
  gap: 8px;
}

.stat-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 10px;
  border-radius: 16px;
  font-size: 14px;
  font-weight: 500;
  color: white;
  min-width: 30px;
}

.stat-pill.fetch {
  background-color: #3b82f6;
}

.stat-pill.realtime {
  background-color: #8b5cf6;
}

.stat-pill.error {
  background-color: #ef4444;
}

/* Filters section */
.filters-section {
  margin-bottom: 16px;
}

.filter-row {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  align-items: center;
}

.search-container {
  position: relative;
  flex-grow: 1;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
}

.search-input {
  padding: 10px 36px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  width: 100%;
  background-color: #ffffff;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-input:focus {
  border-color: #4f46e5;
  outline: none;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1);
}

.search-clear {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
}

.search-clear:hover {
  background-color: #f3f4f6;
  color: #4b5563;
}

.filter-select {
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  min-width: 160px;
  background-color: white;
}

.filter-options {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

.option-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
  user-select: none;
}

.option-toggle input {
  accent-color: #4f46e5;
  width: 16px;
  height: 16px;
}

.toggle-label {
  position: relative;
  top: 1px;
}

.refresh-btn {
  padding: 10px;
  background-color: #f9fafb;
  color: #4b5563;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.refresh-btn:hover {
  background-color: #f3f4f6;
  color: #111827;
}

.info-text {
  color: #6b7280;
  font-size: 14px;
  margin: 0 0 16px;
  line-height: 1.6;
}

/* Logs container */
.logs-container {
  max-height: 65vh;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background-color: #ffffff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.85em;
}

th, td {
  border-bottom: 1px solid #e5e7eb;
  padding: 12px 16px;
  text-align: left;
  vertical-align: top;
}

th {
  background-color: #f9fafb;
  position: sticky;
  top: 0;
  z-index: 1;
  font-weight: 600;
  color: #374151;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 2px solid #e5e7eb;
}

/* Fixed column widths */
.timestamp-col {
  width: 120px;
  white-space: nowrap;
}

.event-col {
  width: 180px;
}

.duration-col {
  width: 90px;
  text-align: right;
  font-family: monospace;
  font-size: 0.9em;
}

.duration-fast {
  color: #047857; /* Green for fast */
}

.duration-medium {
  color: #b45309; /* Amber for medium */
}

.duration-slow {
  color: #b91c1c; /* Red for slow */
}

.duration-col .no-duration {
  color: #9ca3af;
}

.details-col {
  cursor: pointer;
}

.details-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.expand-icon {
  transition: transform 0.2s;
  color: #9ca3af;
}

.expanded .expand-icon {
  transform: rotate(180deg);
}

pre {
  white-space: pre-wrap;
  word-break: break-all;
  margin: 10px 0 4px;
  font-size: 0.95em;
  background-color: #f8fafc;
  padding: 12px;
  border-radius: 6px;
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #f1f5f9;
}

/* Row styling */
.log-error {
  background-color: #fff1f2 !important;
}
.log-error td {
  border-bottom-color: #fecdd3 !important;
}

.log-success {
  background-color: #f0fdf4 !important;
}
.log-success td {
  border-bottom-color: #d1fae5 !important;
}

.log-start {
  background-color: #eff6ff !important;
}

.log-item {
  background-color: #fffbeb !important;
}

/* Event badges */
.event-fetch, .event-realtime, .event-item, .event-error, .event-other {
  padding: 3px 8px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 4px;
  display: inline-block;
  color: white;
}

.event-fetch {
  background-color: #3b82f6;
}

.event-realtime {
  background-color: #8b5cf6;
}

.event-item {
  background-color: #f59e0b;
}

.event-error {
  background-color: #ef4444;
}

.event-other {
  background-color: #6b7280;
}

/* Group headers */
.group-header {
  background-color: #f8fafc !important;
  cursor: pointer;
  font-weight: 500;
  border-top: 1px solid #e5e7eb;
}

.group-header:hover {
  background-color: #f1f5f9 !important;
}

.group-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
}

.group-badge {
  text-transform: uppercase;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background-color: #e2e8f0;
  color: white;
}

.group-badge.group-fetch {
  background-color: #3b82f6;
}

.group-badge.group-realtime {
  background-color: #8b5cf6;
}

.group-badge.group-item {
  background-color: #f59e0b;
}

.group-badge.group-error {
  background-color: #ef4444;
}

.group-count {
  font-size: 12px;
  color: #6b7280;
  margin-left: 5px;
  font-weight: normal;
}

.group-duration {
  margin-left: auto;
  font-family: monospace;
  background-color: #f1f5f9;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: #0f172a;
}

.child-row td:first-child {
  padding-left: 36px;
  position: relative;
}

.child-row td:first-child::before {
  content: "";
  position: absolute;
  left: 20px;
  top: 0;
  height: 100%;
  width: 1px;
  background-color: #e5e7eb;
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #6b7280;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  background-color: #f9fafb;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.empty-icon {
  font-size: 36px;
  color: #9ca3af;
}

/* Responsive styles */
@media (max-width: 768px) {
  .timing-logs-page {
    padding: 16px;
  }
  
  header {
    flex-wrap: wrap;
  }
  
  .status-indicator {
    order: 3;
    margin: 10px 0 0;
    width: 100%;
    display: flex;
    justify-content: center;
  }
  
  .stats-bar {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  }
  
  .filter-row {
    flex-direction: column;
    align-items: stretch;
  }
  
  .filter-options {
    flex-direction: column;
    gap: 12px;
  }
  
  .group-duration {
    display: none;
  }
}
</style>