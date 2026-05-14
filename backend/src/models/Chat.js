const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    role: {type: String, enum: ['user', 'assistant'], required: true},
    content: {type: String, required: true},
    time: {type: String},
    tool: {type: mongoose.Schema.Types.Mixed},
  },
  {_id: false},
);

const chatSchema = new mongoose.Schema(
  {
    user: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    preview: {type: String, default: 'Chat'},
    messages: [messageSchema],
  },
  {timestamps: true},
);

module.exports = mongoose.model('Chat', chatSchema);
