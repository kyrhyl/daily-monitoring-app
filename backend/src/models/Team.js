const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Team name is required'],
    trim: true,
    maxlength: [100, 'Team name cannot exceed 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  teamLeader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Team leader is required']
  },
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    role: {
      type: String,
      enum: ['team_leader', 'member'],
      default: 'member'
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  settings: {
    allowMemberInvite: {
      type: Boolean,
      default: false
    },
    publicVisibility: {
      type: Boolean,
      default: false
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
teamSchema.index({ teamLeader: 1 });
teamSchema.index({ 'members.user': 1 });
teamSchema.index({ isActive: 1 });
teamSchema.index({ createdBy: 1 });

// Virtual for active members count
teamSchema.virtual('activeMembersCount').get(function() {
  return this.members ? this.members.length : 0;
});

// Method to check if user is team leader
teamSchema.methods.isTeamLeader = function(userId) {
  return this.teamLeader.toString() === userId.toString();
};

// Method to check if user is team member
teamSchema.methods.isMember = function(userId) {
  return this.members.some(member => 
    member.user.toString() === userId.toString()
  );
};

// Method to add member to team
teamSchema.methods.addMember = function(userId, role = 'member') {
  const existingMember = this.members.find(member => 
    member.user.toString() === userId.toString()
  );
  
  if (!existingMember) {
    this.members.push({
      user: userId,
      role: role,
      joinedAt: new Date()
    });
  }
  
  return this;
};

// Method to remove member from team
teamSchema.methods.removeMember = function(userId) {
  this.members = this.members.filter(member => 
    member.user.toString() !== userId.toString()
  );
  return this;
};

// Pre-save middleware to ensure team leader is also in members array
teamSchema.pre('save', function(next) {
  if (this.teamLeader) {
    const leaderInMembers = this.members.find(member => 
      member.user.toString() === this.teamLeader.toString()
    );
    
    if (!leaderInMembers) {
      this.members.push({
        user: this.teamLeader,
        role: 'team_leader',
        joinedAt: new Date()
      });
    }
  }
  next();
});

module.exports = mongoose.model('Team', teamSchema);