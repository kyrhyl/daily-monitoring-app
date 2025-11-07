const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  role: {
    type: String,
    enum: ['admin', 'team_leader', 'member'],
    default: 'member'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  teams: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  }],
  profile: {
    avatar: String,
    phone: String,
    department: String,
    position: String,
    joinDate: {
      type: Date,
      default: Date.now
    }
  },
  lastLogin: Date,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for better performance
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

// Virtual for user's full profile
userSchema.virtual('fullProfile').get(function() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    isActive: this.isActive,
    profile: this.profile,
    teams: this.teams,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
});

// Don't include password in JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

// Method to check if user can manage other users
userSchema.methods.canManageUsers = function() {
  return this.role === 'admin';
};

// Method to check if user can manage teams
userSchema.methods.canManageTeams = function() {
  return this.role === 'admin';
};

// Method to check if user can manage projects
userSchema.methods.canManageProjects = function() {
  return ['admin', 'team_leader'].includes(this.role);
};

// Add pagination plugin
userSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('User', userSchema);