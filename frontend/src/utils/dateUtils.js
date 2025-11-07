import { format, formatDistanceToNow, isAfter, isBefore, addDays } from 'date-fns';

// Format date for display
export const formatDate = (date, formatString = 'MMM dd, yyyy') => {
  if (!date) return '';
  return format(new Date(date), formatString);
};

// Format date and time
export const formatDateTime = (date) => {
  if (!date) return '';
  return format(new Date(date), 'MMM dd, yyyy HH:mm');
};

// Get relative time (e.g., "2 hours ago")
export const getRelativeTime = (date) => {
  if (!date) return '';
  return formatDistanceToNow(new Date(date), { addSuffix: true });
};

// Check if date is overdue
export const isOverdue = (dueDate, status = null) => {
  if (!dueDate) return false;
  if (status && ['completed', 'cancelled'].includes(status)) return false;
  return isAfter(new Date(), new Date(dueDate));
};

// Check if date is due soon (within next 3 days)
export const isDueSoon = (dueDate, status = null) => {
  if (!dueDate) return false;
  if (status && ['completed', 'cancelled'].includes(status)) return false;
  
  const now = new Date();
  const due = new Date(dueDate);
  const threeDaysFromNow = addDays(now, 3);
  
  return isAfter(due, now) && isBefore(due, threeDaysFromNow);
};

// Get days until due date
export const getDaysUntilDue = (dueDate) => {
  if (!dueDate) return null;
  
  const now = new Date();
  const due = new Date(dueDate);
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

// Get business days between two dates
export const getBusinessDays = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;
  
  let count = 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const day = date.getDay();
    if (day !== 0 && day !== 6) { // Skip weekends
      count++;
    }
  }
  
  return count;
};

export default {
  formatDate,
  formatDateTime,
  getRelativeTime,
  isOverdue,
  isDueSoon,
  getDaysUntilDue,
  getBusinessDays,
};