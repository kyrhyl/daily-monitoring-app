const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true,
    maxlength: [100, 'Project name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Project description is required'],
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: [true, 'Team is required']
  },
  projectManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Project manager is required']
  },
  assignedMembers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    role: {
      type: String,
      enum: ['project_manager', 'developer', 'tester', 'designer', 'other'],
      default: 'developer'
    }
  }],
  status: {
    type: String,
    enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'],
    default: 'planning'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  actualEndDate: Date,
  budget: {
    allocated: {
      type: Number,
      default: 0
    },
    spent: {
      type: Number,
      default: 0
    }
  },
  tags: [String],
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
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
projectSchema.index({ team: 1 });
projectSchema.index({ projectManager: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ priority: 1 });
projectSchema.index({ startDate: 1, endDate: 1 });
projectSchema.index({ 'assignedMembers.user': 1 });

// Virtual for project duration in days
projectSchema.virtual('duration').get(function() {
  if (this.startDate && this.endDate) {
    const timeDiff = this.endDate.getTime() - this.startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }
  return 0;
});

// Virtual for progress percentage
projectSchema.virtual('progressPercentage').get(function() {
  const now = new Date();
  if (this.status === 'completed') return 100;
  if (this.status === 'cancelled') return 0;
  if (now < this.startDate) return 0;
  if (now > this.endDate) return 100;
  
  const totalDuration = this.endDate.getTime() - this.startDate.getTime();
  const elapsed = now.getTime() - this.startDate.getTime();
  return Math.round((elapsed / totalDuration) * 100);
});

// Virtual for budget utilization percentage
projectSchema.virtual('budgetUtilization').get(function() {
  if (this.budget.allocated === 0) return 0;
  return Math.round((this.budget.spent / this.budget.allocated) * 100);
});

// Method to check if user is project manager
projectSchema.methods.isProjectManager = function(userId) {
  return this.projectManager.toString() === userId.toString();
};

// Method to check if user is assigned to project
projectSchema.methods.isAssignedMember = function(userId) {
  return this.assignedMembers.some(member => 
    member.user.toString() === userId.toString()
  );
};

// Method to add member to project
projectSchema.methods.addMember = function(userId, role = 'developer') {
  const existingMember = this.assignedMembers.find(member => 
    member.user.toString() === userId.toString()
  );
  
  if (!existingMember) {
    this.assignedMembers.push({
      user: userId,
      role: role,
      assignedAt: new Date()
    });
  }
  
  return this;
};

// Method to remove member from project
projectSchema.methods.removeMember = function(userId) {
  this.assignedMembers = this.assignedMembers.filter(member => 
    member.user.toString() !== userId.toString()
  );
  return this;
};

// Validation: End date should be after start date
projectSchema.pre('save', function(next) {
  if (this.startDate && this.endDate && this.endDate <= this.startDate) {
    next(new Error('End date must be after start date'));
  } else {
    next();
  }
});

module.exports = mongoose.model('Project', projectSchema);