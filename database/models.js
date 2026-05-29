const mongoose = require('mongoose');

// User Schema
const userSchema = new mongoose.Schema({
    jid: { type: String, unique: true },
    name: { type: String, default: 'Unknown' },
    deviceId: { type: String },
    linkedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    mustFollowChannel: { type: Boolean, default: false },
    lastActive: { type: Date, default: Date.now },
    lastMessageTime: { type: Date },
    messageCount: { type: Number, default: 0 },
    spamCount: { type: Number, default: 0 },
    warnings: { type: Number, default: 0 },
    joinedGroups: [{ type: String }],
    joinedAt: { type: Date, default: Date.now }
});

// Group Schema
const groupSchema = new mongoose.Schema({
    jid: { type: String, unique: true },
    name: { type: String },
    sleeping: { type: Boolean, default: false },
    participants: [{ type: String }]
});

// Channel Subscriber Schema
const channelSubscriberSchema = new mongoose.Schema({
    jid: { type: String, unique: true },
    name: { type: String },
    subscribedAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true }
});

module.exports = {
    User: mongoose.model('User', userSchema),
    Group: mongoose.model('Group', groupSchema),
    ChannelSubscriber: mongoose.model('ChannelSubscriber', channelSubscriberSchema)
};
