import clsx from 'clsx';

// Status color mappings
export const statusColors = {
  // Task statuses
  todo: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  review: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  
  // Project statuses
  planning: 'bg-purple-100 text-purple-800',
  active: 'bg-blue-100 text-blue-800',
  on_hold: 'bg-yellow-100 text-yellow-800',
  
  // User roles
  admin: 'bg-red-100 text-red-800',
  team_leader: 'bg-blue-100 text-blue-800',
  member: 'bg-gray-100 text-gray-800',
  
  // Priorities
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

// Priority colors for borders, backgrounds, etc.
export const priorityColors = {
  low: {
    border: 'border-gray-300',
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    accent: 'bg-gray-500',
  },
  medium: {
    border: 'border-yellow-300',
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    accent: 'bg-yellow-500',
  },
  high: {
    border: 'border-orange-300',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    accent: 'bg-orange-500',
  },
  critical: {
    border: 'border-red-300',
    bg: 'bg-red-50',
    text: 'text-red-700',
    accent: 'bg-red-500',
  },
};

// Get status badge classes
export const getStatusBadge = (status, type = 'default') => {
  const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
  const colorClasses = statusColors[status] || statusColors.todo;
  
  return clsx(baseClasses, colorClasses);
};

// Get priority indicator classes
export const getPriorityIndicator = (priority) => {
  const colors = priorityColors[priority] || priorityColors.medium;
  return colors.accent;
};

// Get role badge classes
export const getRoleBadge = (role) => {
  const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
  const colorClasses = statusColors[role] || statusColors.member;
  
  return clsx(baseClasses, colorClasses);
};

// Format status text for display
export const formatStatus = (status) => {
  if (!status) return '';
  
  const statusMap = {
    todo: 'To Do',
    in_progress: 'In Progress',
    review: 'In Review',
    completed: 'Completed',
    cancelled: 'Cancelled',
    planning: 'Planning',
    active: 'Active',
    on_hold: 'On Hold',
    team_leader: 'Team Leader',
    admin: 'Admin',
    member: 'Member',
  };
  
  return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
};

// Format priority text for display
export const formatPriority = (priority) => {
  if (!priority) return '';
  return priority.charAt(0).toUpperCase() + priority.slice(1);
};

// Get progress bar color based on percentage and status
export const getProgressColor = (percentage, isOverdue = false) => {
  if (isOverdue) return 'bg-red-500';
  if (percentage >= 75) return 'bg-green-500';
  if (percentage >= 50) return 'bg-yellow-500';
  if (percentage >= 25) return 'bg-orange-500';
  return 'bg-gray-400';
};

// Truncate text with ellipsis
export const truncateText = (text, maxLength = 100) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// Generate avatar initials
export const getInitials = (name) => {
  if (!name) return '??';
  
  const names = name.trim().split(' ');
  if (names.length === 1) {
    return names[0].substring(0, 2).toUpperCase();
  }
  
  return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
};

// Generate random avatar color
export const getAvatarColor = (name) => {
  if (!name) return 'bg-gray-500';
  
  const colors = [
    'bg-red-500',
    'bg-yellow-500',
    'bg-green-500',
    'bg-blue-500',
    'bg-indigo-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-gray-500',
  ];
  
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

// Format file size
export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

// Validate email format
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Generate random ID
export const generateId = () => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

export default {
  statusColors,
  priorityColors,
  getStatusBadge,
  getPriorityIndicator,
  getRoleBadge,
  formatStatus,
  formatPriority,
  getProgressColor,
  truncateText,
  getInitials,
  getAvatarColor,
  formatFileSize,
  isValidEmail,
  generateId,
};