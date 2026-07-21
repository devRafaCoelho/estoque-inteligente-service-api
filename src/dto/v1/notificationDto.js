const NotificationDto = (row) => ({
  id: row.id,
  type: row.type,
  title: row.title,
  body: row.body,
  productId: row.product_id || null,
  payload: row.payload || {},
  readAt: row.read_at || null,
  createdAt: row.created_at,
  unread: !row.read_at,
});

module.exports = { NotificationDto };
