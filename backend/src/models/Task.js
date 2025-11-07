const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [200, 'Task title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Task description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Project is required']
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Assigned user is required']
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Task creator is required']
  },
  status: {
    type: String,
    enum: ['todo', 'in_progress', 'review', 'completed', 'cancelled'],
    default: 'todo'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  type: {
    type: String,
    enum: ['feature', 'bug', 'improvement', 'research', 'testing', 'documentation', 'other'],
    default: 'feature'
  },
  estimatedHours: {
    type: Number,
    min: 0,
    default: 0
  },
  actualHours: {
    type: Number,
    min: 0,
    default: 0
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  completedDate: Date,
  tags: [String],
  dependencies: [{
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task'
    },
    type: {
      type: String,
      enum: ['blocks', 'depends_on'],
      default: 'depends_on'
    }
  }],
  attachments: [{
    name: String,
    url: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    comment: {
      type: String,
      required: true,
      maxlength: 1000
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  progressUpdates: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['todo', 'in_progress', 'review', 'completed', 'cancelled'],
      required: true
    },
    comment: String,
    hoursWorked: {
      type: Number,
      min: 0,
      default: 0
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes for better performance
taskSchema.index({ project: 1 });
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ assignedBy: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ priority: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ startDate: 1, dueDate: 1 });

// Virtual for task duration in days
taskSchema.virtual('duration').get(function() {
  if (this.startDate && this.dueDate) {
    const timeDiff = this.dueDate.getTime() - this.startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }
  return 0;
});

// Virtual for time remaining in days
taskSchema.virtual('timeRemaining').get(function() {
  if (this.status === 'completed' || this.status === 'cancelled') return 0;
  
  const now = new Date();
  if (this.dueDate) {
    const timeDiff = this.dueDate.getTime() - now.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }
  return 0;
});

// Virtual for checking if task is overdue
taskSchema.virtual('isOverdue').get(function() {
  if (this.status === 'completed' || this.status === 'cancelled') return false;
  return new Date() > this.dueDate;
});

// Virtual for progress percentage based on status
taskSchema.virtual('progressPercentage').get(function() {
  const statusProgress = {
    'todo': 0,
    'in_progress': 25,
    'review': 75,
    'completed': 100,
    'cancelled': 0
  };
  return statusProgress[this.status] || 0;
});

// Method to add comment
taskSchema.methods.addComment = function(userId, comment) {
  this.comments.push({
    user: userId,
    comment: comment,
    createdAt: new Date()
  });
  return this;
};

// Method to update progress
taskSchema.methods.updateProgress = function(userId, status, comment, hoursWorked = 0) {
  this.progressUpdates.push({
    user: userId,
    status: status,
    comment: comment,
    hoursWorked: hoursWorked,
    updatedAt: new Date()
  });
  
  // Update task status and actual hours
  this.status = status;
  this.actualHours += hoursWorked;
  
  // Set completion date if completed
  if (status === 'completed') {
    this.completedDate = new Date();
  }
  
  return this;
};

// Method to check if user can modify task
taskSchema.methods.canModify = function(userId, userRole) {
  // Admin can modify any task
  if (userRole === 'admin') return true;
  
  // Task assignee can modify
  if (this.assignedTo.toString() === userId.toString()) return true;
  
  // Task creator can modify
  if (this.assignedBy.toString() === userId.toString()) return true;
  
  return false;
};

// Validation: Due date should be after start date
taskSchema.pre('save', function(next) {
  if (this.startDate && this.dueDate && this.dueDate <= this.startDate) {
    next(new Error('Due date must be after start date'));
  } else {
    next();
  }
});

module.exports = mongoose.model('Task', taskSchema);