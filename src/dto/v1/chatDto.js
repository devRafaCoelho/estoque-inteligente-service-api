const ChatSessionDto = (row) => ({
  id: row.id,
  title: row.title || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const ChatMessageDto = (row) => ({
  id: row.id,
  role: row.role,
  content: row.content,
  payload: row.payload || {},
  createdAt: row.created_at,
});

module.exports = {
  ChatSessionDto,
  ChatMessageDto,
};
