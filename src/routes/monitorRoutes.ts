import express from 'express';
import path from 'path';

const router = express.Router();

// Lista de APIs para monitorar
const apis = [
    // AUTH
    { name: 'POST /api/auth/login', url: '/api/auth/login', method: 'POST' },
    { name: 'POST /api/auth/register', url: '/api/auth/register', method: 'POST' },
    { name: 'POST /api/auth/logout', url: '/api/auth/logout', method: 'POST' },
    { name: 'GET /api/auth/me', url: '/api/auth/me', method: 'GET' },
    { name: 'POST /api/auth/refresh', url: '/api/auth/refresh', method: 'POST' },

    // USERS
    { name: 'GET /api/users/me', url: '/api/users/me', method: 'GET' },
    { name: 'GET /api/users/search', url: '/api/users/search', method: 'GET' },
    { name: 'POST /api/users/avatar', url: '/api/users/avatar', method: 'POST' },
    { name: 'GET /api/users/online', url: '/api/users/online', method: 'GET' },
    { name: 'POST /api/user/online', url: '/api/user/online', method: 'POST' },
    { name: 'POST /api/user/offline', url: '/api/user/offline', method: 'POST' },
    { name: 'GET /api/user/status/:userId', url: '/api/user/status/test123', method: 'GET' },

    // ACTIVITIES
    { name: 'GET /api/activities', url: '/api/activities', method: 'GET' },
    { name: 'POST /api/activities', url: '/api/activities', method: 'POST' },
    { name: 'GET /api/activities/user/:userId', url: '/api/activities/user/test123', method: 'GET' },
    { name: 'GET /api/activities/stream/:streamId', url: '/api/activities/stream/test123', method: 'GET' },
    { name: 'DELETE /api/activities/:id', url: '/api/activities/test123', method: 'DELETE' },

    // ADMIN
    { name: 'GET /api/admin/users', url: '/api/admin/users', method: 'GET' },
    { name: 'POST /api/admin/users', url: '/api/admin/users', method: 'POST' },
    { name: 'PUT /api/admin/users/:id', url: '/api/admin/users/test123', method: 'PUT' },
    { name: 'DELETE /api/admin/users/:id', url: '/api/admin/users/test123', method: 'DELETE' },
    { name: 'GET /api/admin/stats', url: '/api/admin/stats', method: 'GET' },
    { name: 'POST /api/admin/broadcast', url: '/api/admin/broadcast', method: 'POST' },

    // AVATAR/FRAMES
    { name: 'GET /api/frames', url: '/api/frames', method: 'GET' },
    { name: 'POST /api/frames', url: '/api/frames', method: 'POST' },
    { name: 'GET /api/frames/:id', url: '/api/frames/test123', method: 'GET' },
    { name: 'PUT /api/frames/:id', url: '/api/frames/test123', method: 'PUT' },
    { name: 'DELETE /api/frames/:id', url: '/api/frames/test123', method: 'DELETE' },
    { name: 'GET /api/frames/user/:userId', url: '/api/frames/user/test123', method: 'GET' },
    { name: 'POST /api/frames/purchase/:frameId', url: '/api/frames/purchase/test123', method: 'POST' },

    // BLOCKS
    { name: 'GET /api/blocks', url: '/api/blocks', method: 'GET' },
    { name: 'POST /api/blocks', url: '/api/blocks', method: 'POST' },
    { name: 'DELETE /api/blocks/:id', url: '/api/blocks/test123', method: 'DELETE' },
    { name: 'GET /api/blocks/user/:userId', url: '/api/blocks/user/test123', method: 'GET' },
    { name: 'POST /api/blocks/check/:userId1/:userId2', url: '/api/blocks/check/test123/test456', method: 'POST' },

    // CHAT
    { name: 'GET /api/chats', url: '/api/chats', method: 'GET' },
    { name: 'POST /api/chats', url: '/api/chats', method: 'POST' },
    { name: 'GET /api/chats/:id', url: '/api/chats/test123', method: 'GET' },
    { name: 'PUT /api/chats/:id', url: '/api/chats/test123', method: 'PUT' },
    { name: 'DELETE /api/chats/:id', url: '/api/chats/test123', method: 'DELETE' },
    { name: 'POST /api/chats/:id/join', url: '/api/chats/test123/join', method: 'POST' },
    { name: 'POST /api/chats/:id/leave', url: '/api/chats/test123/leave', method: 'POST' },

    // CONTRIBUTION
    { name: 'GET /api/contribution/ranking', url: '/api/contribution/ranking', method: 'GET' },
    { name: 'POST /api/contribution/record', url: '/api/contribution/record', method: 'POST' },
    { name: 'GET /api/contribution/user/:userId', url: '/api/contribution/user/test123', method: 'GET' },
    { name: 'GET /api/contribution/stats', url: '/api/contribution/stats', method: 'GET' },

    // CHECKOUT
    { name: 'POST /api/checkout/pix', url: '/api/checkout/pix', method: 'POST' },
    { name: 'POST /api/checkout/credit-card', url: '/api/checkout/credit-card', method: 'POST' },
    { name: 'GET /api/checkout/status/:paymentId', url: '/api/checkout/status/test123', method: 'GET' },
    { name: 'POST /api/checkout/webhook', url: '/api/checkout/webhook', method: 'POST' },

    // FRIENDSHIP
    { name: 'GET /api/friends', url: '/api/friends', method: 'GET' },
    { name: 'POST /api/friends/request', url: '/api/friends/request', method: 'POST' },
    { name: 'POST /api/friends/accept/:userId', url: '/api/friends/accept/test123', method: 'POST' },
    { name: 'POST /api/friends/reject/:userId', url: '/api/friends/reject/test123', method: 'POST' },
    { name: 'DELETE /api/friends/:userId', url: '/api/friends/test123', method: 'DELETE' },
    { name: 'GET /api/friends/mutual/:userId1/:userId2', url: '/api/friends/mutual/test123/test456', method: 'GET' },
    { name: 'GET /api/friends/check/:userId1/:userId2', url: '/api/friends/check/test123/test456', method: 'GET' },

    // FOLLOWERS
    { name: 'GET /api/followers', url: '/api/followers', method: 'GET' },
    { name: 'POST /api/followers/follow', url: '/api/followers/follow', method: 'POST' },
    { name: 'POST /api/followers/unfollow', url: '/api/followers/unfollow', method: 'POST' },
    { name: 'GET /api/followers/following/:userId', url: '/api/followers/following/test123', method: 'GET' },
    { name: 'GET /api/followers/followers/:userId', url: '/api/followers/followers/test123', method: 'GET' },
    { name: 'GET /api/followers/stats/:userId', url: '/api/followers/stats/test123', method: 'GET' },

    // GIFTS
    { name: 'GET /api/gifts', url: '/api/gifts', method: 'GET' },
    { name: 'POST /api/gifts', url: '/api/gifts', method: 'POST' },
    { name: 'GET /api/gifts/:id', url: '/api/gifts/test123', method: 'GET' },
    { name: 'PUT /api/gifts/:id', url: '/api/gifts/test123', method: 'PUT' },
    { name: 'DELETE /api/gifts/:id', url: '/api/gifts/test123', method: 'DELETE' },
    { name: 'POST /api/gifts/send', url: '/api/gifts/send', method: 'POST' },
    { name: 'GET /api/gifts/history/:userId', url: '/api/gifts/history/test123', method: 'GET' },

    // INTERACTIONS
    { name: 'GET /api/interactions/presents', url: '/api/interactions/presents', method: 'GET' },
    { name: 'POST /api/interactions/presents/send', url: '/api/interactions/presents/send', method: 'POST' },
    { name: 'GET /api/interactions/streams', url: '/api/interactions/streams', method: 'GET' },
    { name: 'POST /api/interactions/streams/:streamId/join', url: '/api/interactions/streams/test123/join', method: 'POST' },
    { name: 'POST /api/interactions/streams/:streamId/leave', url: '/api/interactions/streams/test123/leave', method: 'POST' },

    // LIKES
    { name: 'POST /api/likes', url: '/api/likes', method: 'POST' },
    { name: 'DELETE /api/likes/:id', url: '/api/likes/test123', method: 'DELETE' },
    { name: 'GET /api/likes/user/:userId', url: '/api/likes/user/test123', method: 'GET' },
    { name: 'GET /api/likes/content/:contentType/:contentId', url: '/api/likes/content/photo/test123', method: 'GET' },
    { name: 'GET /api/likes/stats/:contentId', url: '/api/likes/stats/test123', method: 'GET' },

    // LIVE
    { name: 'GET /api/live', url: '/api/live', method: 'GET' },
    { name: 'POST /api/live/start', url: '/api/live/start', method: 'POST' },
    { name: 'POST /api/live/stop/:streamId', url: '/api/live/stop/test123', method: 'POST' },
    { name: 'GET /api/live/:streamId', url: '/api/live/test123', method: 'GET' },
    { name: 'PUT /api/live/:streamId', url: '/api/live/test123', method: 'PUT' },
    { name: 'GET /api/live/active', url: '/api/live/active', method: 'GET' },
    { name: 'GET /api/live/user/:userId', url: '/api/live/user/test123', method: 'GET' },

    // LOCATION
    { name: 'GET /api/location', url: '/api/location', method: 'GET' },
    { name: 'POST /api/location', url: '/api/location', method: 'POST' },
    { name: 'GET /api/location/:userId', url: '/api/location/test123', method: 'GET' },
    { name: 'PUT /api/location/:userId', url: '/api/location/test123', method: 'PUT' },
    { name: 'DELETE /api/location/:userId', url: '/api/location/test123', method: 'DELETE' },
    { name: 'GET /api/location/nearby', url: '/api/location/nearby', method: 'GET' },

    // MEDIA
    { name: 'GET /api/media', url: '/api/media', method: 'GET' },
    { name: 'POST /api/media', url: '/api/media', method: 'POST' },
    { name: 'GET /api/media/:id', url: '/api/media/test123', method: 'GET' },
    { name: 'DELETE /api/media/:id', url: '/api/media/test123', method: 'DELETE' },
    { name: 'GET /api/media/user/:userId', url: '/api/media/user/test123', method: 'GET' },

    // MESSAGES
    { name: 'GET /api/messages', url: '/api/messages', method: 'GET' },
    { name: 'POST /api/messages/send', url: '/api/messages/send', method: 'POST' },
    { name: 'GET /api/messages/:userId', url: '/api/messages/test123', method: 'GET' },
    { name: 'DELETE /api/messages/:id', url: '/api/messages/test123', method: 'DELETE' },

    // METADATA
    { name: 'GET /api/ranking', url: '/api/ranking', method: 'GET' },
    { name: 'GET /api/regions', url: '/api/regions', method: 'GET' },
    { name: 'GET /api/history', url: '/api/history', method: 'GET' },
    { name: 'POST /api/history', url: '/api/history', method: 'POST' },

    // PAYMENTS
    { name: 'POST /api/payments/pix', url: '/api/payments/pix', method: 'POST' },
    { name: 'POST /api/payments/credit-card', url: '/api/payments/credit-card', method: 'POST' },
    { name: 'GET /api/payments/status/:paymentId', url: '/api/payments/status/test123', method: 'GET' },
    { name: 'POST /api/payments/webhook', url: '/api/payments/webhook', method: 'POST' },

    // PHOTOS
    { name: 'GET /api/photos', url: '/api/photos', method: 'GET' },
    { name: 'POST /api/photos', url: '/api/photos', method: 'POST' },
    { name: 'GET /api/photos/:id', url: '/api/photos/test123', method: 'GET' },
    { name: 'PUT /api/photos/:id', url: '/api/photos/test123', method: 'PUT' },
    { name: 'DELETE /api/photos/:id', url: '/api/photos/test123', method: 'DELETE' },
    { name: 'POST /api/photos/:id/like', url: '/api/photos/test123/like', method: 'POST' },
    { name: 'DELETE /api/photos/:id/like', url: '/api/photos/test123/like', method: 'DELETE' },

    // PK
    { name: 'GET /api/pk', url: '/api/pk', method: 'GET' },
    { name: 'POST /api/pk/start', url: '/api/pk/start', method: 'POST' },
    { name: 'POST /api/pk/end/:battleId', url: '/api/pk/end/test123', method: 'POST' },
    { name: 'GET /api/pk/:battleId', url: '/api/pk/test123', method: 'GET' },
    { name: 'POST /api/pk/vote', url: '/api/pk/vote', method: 'POST' },

    // PROFILE
    { name: 'GET /api/perfil/:id', url: '/api/perfil/test123', method: 'GET' },
    { name: 'PUT /api/perfil/:id', url: '/api/perfil/test123', method: 'PUT' },
    { name: 'POST /api/perfil/:id/follow', url: '/api/perfil/test123/follow', method: 'POST' },
    { name: 'POST /api/perfil/:id/unfollow', url: '/api/perfil/test123/unfollow', method: 'POST' },
    { name: 'GET /api/perfil/:id/followers', url: '/api/perfil/test123/followers', method: 'GET' },
    { name: 'GET /api/perfil/:id/following', url: '/api/perfil/test123/following', method: 'GET' },

    // PURCHASE
    { name: 'GET /api/purchase', url: '/api/purchase', method: 'GET' },
    { name: 'POST /api/purchase', url: '/api/purchase', method: 'POST' },
    { name: 'GET /api/purchase/:id', url: '/api/purchase/test123', method: 'GET' },
    { name: 'GET /api/purchase/user/:userId', url: '/api/purchase/user/test123', method: 'GET' },
    { name: 'POST /api/purchase/confirm', url: '/api/purchase/confirm', method: 'POST' },
    { name: 'POST /api/purchase/cancel', url: '/api/purchase/cancel', method: 'POST' },

    // SEARCH
    { name: 'GET /api/search/users', url: '/api/search/users', method: 'GET' },
    { name: 'GET /api/search/streams', url: '/api/search/streams', method: 'GET' },
    { name: 'GET /api/search/content', url: '/api/search/content', method: 'GET' },
    { name: 'GET /api/search/global', url: '/api/search/global', method: 'GET' },

    // SETTINGS
    { name: 'GET /api/settings', url: '/api/settings', method: 'GET' },
    { name: 'PUT /api/settings', url: '/api/settings', method: 'PUT' },
    { name: 'GET /api/settings/:id', url: '/api/settings/test123', method: 'GET' },
    { name: 'PUT /api/settings/:id', url: '/api/settings/test123', method: 'PUT' },
    { name: 'GET /api/notifications/settings', url: '/api/notifications/settings', method: 'GET' },
    { name: 'PUT /api/notifications/settings', url: '/api/notifications/settings', method: 'PUT' },
    { name: 'GET /api/permissions', url: '/api/permissions', method: 'GET' },

    // SHOP
    { name: 'GET /api/shop', url: '/api/shop', method: 'GET' },
    { name: 'POST /api/shop/purchase', url: '/api/shop/purchase', method: 'POST' },
    { name: 'GET /api/shop/items', url: '/api/shop/items', method: 'GET' },
    { name: 'GET /api/shop/categories', url: '/api/shop/categories', method: 'GET' },
    { name: 'GET /api/shop/user/:userId', url: '/api/shop/user/test123', method: 'GET' },

    // STATUS
    { name: 'GET /api/status', url: '/api/status', method: 'GET' },
    { name: 'POST /api/status', url: '/api/status', method: 'POST' },
    { name: 'GET /api/status/:userId', url: '/api/status/test123', method: 'GET' },
    { name: 'PUT /api/status/:userId', url: '/api/status/test123', method: 'PUT' },

    // STREAMS
    { name: 'GET /api/streams', url: '/api/streams', method: 'GET' },
    { name: 'POST /api/streams', url: '/api/streams', method: 'POST' },
    { name: 'GET /api/streams/:id', url: '/api/streams/test123', method: 'GET' },
    { name: 'PUT /api/streams/:id', url: '/api/streams/test123', method: 'PUT' },
    { name: 'DELETE /api/streams/:id', url: '/api/streams/test123', method: 'DELETE' },
    { name: 'GET /api/streams/active', url: '/api/streams/active', method: 'GET' },
    { name: 'GET /api/streams/user/:userId', url: '/api/streams/user/test123', method: 'GET' },

    // UPLOAD
    { name: 'POST /api/upload', url: '/api/upload', method: 'POST' },
    { name: 'GET /api/upload', url: '/api/upload', method: 'GET' },
    { name: 'DELETE /api/upload/:id', url: '/api/upload/test123', method: 'DELETE' },
    { name: 'GET /api/upload/user/:userId', url: '/api/upload/user/test123', method: 'GET' },

    // WALLET
    { name: 'GET /api/wallet', url: '/api/wallet', method: 'GET' },
    { name: 'POST /api/wallet', url: '/api/wallet', method: 'POST' },
    { name: 'GET /api/wallet/:id', url: '/api/wallet/test123', method: 'GET' },
    { name: 'PUT /api/wallet/:id', url: '/api/wallet/test123', method: 'PUT' },
    { name: 'GET /api/wallet/earnings', url: '/api/wallet/earnings', method: 'GET' },
    { name: 'GET /api/wallet/purchases', url: '/api/wallet/purchases', method: 'GET' },
    { name: 'POST /api/wallet/withdraw', url: '/api/wallet/withdraw', method: 'POST' },
    { name: 'GET /api/wallet/transactions', url: '/api/wallet/transactions', method: 'GET' },

    // WEBHOOKS
    { name: 'POST /api/webhooks/mercadopago', url: '/api/webhooks/mercadopago', method: 'POST' },
    { name: 'POST /api/webhooks/test', url: '/api/webhooks/test', method: 'POST' },

    // WITHDRAWALS
    { name: 'POST /api/withdrawals/pix', url: '/api/withdrawals/pix', method: 'POST' },
    { name: 'GET /api/withdrawals/status/:transferId', url: '/api/withdrawals/status/test123', method: 'GET' },
    { name: 'GET /api/withdrawals/history/:userId', url: '/api/withdrawals/history/test123', method: 'GET' },

    // TRANSACTION PROTECTION
    { name: 'GET /api/transaction-protection', url: '/api/transaction-protection', method: 'GET' },
    { name: 'POST /api/transaction-protection', url: '/api/transaction-protection', method: 'POST' },
    { name: 'GET /api/transaction-protection/:id', url: '/api/transaction-protection/test123', method: 'GET' },
    { name: 'PUT /api/transaction-protection/:id', url: '/api/transaction-protection/test123', method: 'PUT' },
    { name: 'DELETE /api/transaction-protection/:id', url: '/api/transaction-protection/test123', method: 'DELETE' },
    { name: 'GET /api/transaction-protection/check/:userId1/:userId2', url: '/api/transaction-protection/check/test123/test456', method: 'GET' },

    // BEAUTY EFFECTS
    { name: 'GET /api/beauty/effects', url: '/api/beauty/effects', method: 'GET' },
    { name: 'POST /api/beauty/effects/apply', url: '/api/beauty/effects/apply', method: 'POST' },
    { name: 'POST /api/beauty/effects/save', url: '/api/beauty/effects/save', method: 'POST' },
    { name: 'GET /api/beauty/effects/user/:userId', url: '/api/beauty/effects/user/test123', method: 'GET' },
    { name: 'DELETE /api/beauty/effects/:effectId', url: '/api/beauty/effects/test123', method: 'DELETE' },

    // BIRTHDAYS
    { name: 'GET /api/birthdays', url: '/api/birthdays', method: 'GET' },
    { name: 'GET /api/birthdays/today', url: '/api/birthdays/today', method: 'GET' },
    { name: 'POST /api/birthdays/celebrate', url: '/api/birthdays/celebrate', method: 'POST' },
    { name: 'GET /api/birthdays/user/:userId', url: '/api/birthdays/user/test123', method: 'GET' },

    // STREAMER
    { name: 'GET /api/streamer/info/:userId', url: '/api/streamer/info/test123', method: 'GET' },
    { name: 'POST /api/streamer/update', url: '/api/streamer/update', method: 'POST' },
    { name: 'GET /api/streamer/stats/:userId', url: '/api/streamer/stats/test123', method: 'GET' },
    { name: 'POST /api/streamer/followers', url: '/api/streamer/followers', method: 'POST' },
    { name: 'GET /api/streamer/ranking', url: '/api/streamer/ranking', method: 'GET' },

    // APP VERSIONS
    { name: 'GET /api/appversions', url: '/api/appversions', method: 'GET' },
    { name: 'GET /api/appversions/latest', url: '/api/appversions/latest', method: 'GET' },
    { name: 'POST /api/appversions/check', url: '/api/appversions/check', method: 'POST' },
    { name: 'GET /api/appversions/:platform', url: '/api/appversions/android', method: 'GET' },

    // GAME LIST
    { name: 'GET /api/game-list', url: '/api/game-list', method: 'GET' },
    { name: 'GET /api/game-list/category/:category', url: '/api/game-list/category/action', method: 'GET' },
    { name: 'POST /api/game-list/favorite', url: '/api/game-list/favorite', method: 'POST' },
    { name: 'GET /api/game-list/favorites/:userId', url: '/api/game-list/favorites/test123', method: 'GET' },

    // ROOMS
    { name: 'GET /api/rooms', url: '/api/rooms', method: 'GET' },
    { name: 'POST /api/rooms/create', url: '/api/rooms/create', method: 'POST' },
    { name: 'GET /api/rooms/:id', url: '/api/rooms/test123', method: 'GET' },
    { name: 'POST /api/rooms/:id/join', url: '/api/rooms/test123/join', method: 'POST' },
    { name: 'POST /api/rooms/:id/leave', url: '/api/rooms/test123/leave', method: 'POST' },
    { name: 'DELETE /api/rooms/:id', url: '/api/rooms/test123', method: 'DELETE' },
    { name: 'GET /api/rooms/active', url: '/api/rooms/active', method: 'GET' },
    { name: 'GET /api/rooms/user/:userId', url: '/api/rooms/user/test123', method: 'GET' },

    // NOTIFICATIONS
    { name: 'GET /api/notifications', url: '/api/notifications', method: 'GET' },
    { name: 'POST /api/notifications/send', url: '/api/notifications/send', method: 'POST' },
    { name: 'GET /api/notifications/:userId', url: '/api/notifications/test123', method: 'GET' },
    { name: 'POST /api/notifications/read/:id', url: '/api/notifications/read/test123', method: 'POST' },
    { name: 'DELETE /api/notifications/:id', url: '/api/notifications/test123', method: 'DELETE' },
    { name: 'POST /api/notifications/mark-all-read', url: '/api/notifications/mark-all-read', method: 'POST' },

    // REPORTS
    { name: 'POST /api/reports', url: '/api/reports', method: 'POST' },
    { name: 'GET /api/reports', url: '/api/reports', method: 'GET' },
    { name: 'GET /api/reports/:id', url: '/api/reports/test123', method: 'GET' },
    { name: 'POST /api/reports/:id/review', url: '/api/reports/test123/review', method: 'POST' },
    { name: 'GET /api/reports/user/:userId', url: '/api/reports/user/test123', method: 'GET' },

    // LEVELS
    { name: 'GET /api/levels', url: '/api/levels', method: 'GET' },
    { name: 'GET /api/levels/:userId', url: '/api/levels/test123', method: 'GET' },
    { name: 'POST /api/levels/add-exp', url: '/api/levels/add-exp', method: 'POST' },
    { name: 'GET /api/levels/leaderboard', url: '/api/levels/leaderboard', method: 'GET' },

    // STREAM KEYS
    { name: 'GET /api/stream-keys', url: '/api/stream-keys', method: 'GET' },
    { name: 'POST /api/stream-keys/generate', url: '/api/stream-keys/generate', method: 'POST' },
    { name: 'DELETE /api/stream-keys/:key', url: '/api/stream-keys/test123', method: 'DELETE' },
    { name: 'GET /api/stream-keys/user/:userId', url: '/api/stream-keys/user/test123', method: 'POST' },

    // VISITORS
    { name: 'GET /api/visitors', url: '/api/visitors', method: 'GET' },
    { name: 'GET /api/visitors/:streamId', url: '/api/visitors/test123', method: 'GET' },
    { name: 'POST /api/visitors/track', url: '/api/visitors/track', method: 'POST' },

    // PRIVATE CHAT
    { name: 'GET /api/private-chat', url: '/api/private-chat', method: 'GET' },
    { name: 'POST /api/private-chat/start', url: '/api/private-chat/start', method: 'POST' },
    { name: 'GET /api/private-chat/:chatId', url: '/api/private-chat/test123', method: 'GET' },
    { name: 'POST /api/private-chat/:chatId/message', url: '/api/private-chat/test123/message', method: 'POST' },

    // LIVE EVENTS
    { name: 'GET /api/live-events', url: '/api/live-events', method: 'GET' },
    { name: 'POST /api/live-events/create', url: '/api/live-events/create', method: 'POST' },
    { name: 'GET /api/live-events/:eventId', url: '/api/live-events/test123', method: 'GET' },
    { name: 'POST /api/live-events/:eventId/join', url: '/api/live-events/test123/join', method: 'POST' },

    // ANALYTICS
    { name: 'GET /api/analytics/overview', url: '/api/analytics/overview', method: 'GET' },
    { name: 'GET /api/analytics/stream/:streamId', url: '/api/analytics/stream/test123', method: 'GET' },
    { name: 'GET /api/analytics/user/:userId', url: '/api/analytics/user/test123', method: 'GET' },
    { name: 'POST /api/analytics/track', url: '/api/analytics/track', method: 'POST' },

    // MODERATION
    { name: 'GET /api/moderation/reports', url: '/api/moderation/reports', method: 'GET' },
    { name: 'POST /api/moderation/review', url: '/api/moderation/review', method: 'POST' },
    { name: 'GET /api/moderation/history/:userId', url: '/api/moderation/history/test123', method: 'GET' },

    // CATEGORIES
    { name: 'GET /api/categories', url: '/api/categories', method: 'GET' },
    { name: 'POST /api/categories', url: '/api/categories', method: 'POST' },
    { name: 'GET /api/categories/:id', url: '/api/categories/test123', method: 'GET' },
    { name: 'PUT /api/categories/:id', url: '/api/categories/test123', method: 'PUT' },

    // TAGS
    { name: 'GET /api/tags', url: '/api/tags', method: 'GET' },
    { name: 'POST /api/tags', url: '/api/tags', method: 'POST' },
    { name: 'GET /api/tags/:id', url: '/api/tags/test123', method: 'GET' },
    { name: 'DELETE /api/tags/:id', url: '/api/tags/test123', method: 'DELETE' },

    // EMOJIS
    { name: 'GET /api/emojis', url: '/api/emojis', method: 'GET' },
    { name: 'POST /api/emojis', url: '/api/emojis', method: 'POST' },
    { name: 'GET /api/emojis/:category', url: '/api/emojis/happy', method: 'GET' },
    { name: 'GET /api/emojis/recent', url: '/api/emojis/recent', method: 'GET' },

    // STICKERS
    { name: 'GET /api/stickers', url: '/api/stickers', method: 'GET' },
    { name: 'POST /api/stickers', url: '/api/stickers', method: 'POST' },
    { name: 'GET /api/stickers/packs', url: '/api/stickers/packs', method: 'GET' },
    { name: 'POST /api/stickers/purchase/:packId', url: '/api/stickers/purchase/test123', method: 'POST' }
];

// Função para testar API
async function testAPI(api: any) {
    const startTime = Date.now();
    
    try {
        const response = await fetch(`http://localhost:3000${api.url}`, {
            method: api.method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-token'
            }
        });
        
        const responseTime = Date.now() - startTime;
        const status = response.status;
        
        let responseData;
        try {
            responseData = await response.json();
        } catch {
            responseData = await response.text();
        }
        
        return {
            name: api.name,
            url: api.url,
            method: api.method,
            status,
            responseTime,
            success: status < 400,
            data: responseData
        };
    } catch (error) {
        const responseTime = Date.now() - startTime;
        return {
            name: api.name,
            url: api.url,
            method: api.method,
            status: 0,
            responseTime,
            success: false,
            data: { error: (error as Error).message }
        };
    }
}

// Função para escanear todas as APIs
async function scanAllAPIs() {
    console.log('\n🔍 [MONITOR] Iniciando scan de todas as APIs...');
    console.log(`📊 [MONITOR] Total de APIs: ${apis.length}`);
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < apis.length; i++) {
        const api = apis[i];
        const result = await testAPI(api);
        results.push(result);
        
        if (result.success) {
            successCount++;
            console.log(`✅ [${i + 1}/${apis.length}] ${result.name} - ${result.status} (${result.responseTime}ms)`);
        } else {
            errorCount++;
            console.log(`❌ [${i + 1}/${apis.length}] ${result.name} - ${result.status} (${result.responseTime}ms)`);
        }
        
        // Pequeno delay para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    console.log(`\n📈 [MONITOR] Resultado final:`);
    console.log(`✅ Sucesso: ${successCount} APIs`);
    console.log(`❌ Erros: ${errorCount} APIs`);
    console.log(`📊 Total: ${apis.length} APIs`);
    
    return results;
}

// Rota principal do monitor
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/monitor.html'));
});

// Rota para escanear APIs
router.post('/scan', async (req, res) => {
    try {
        const results = await scanAllAPIs();
        res.json({
            success: true,
            total: results.length,
            successCount: results.filter(r => r.success).length,
            errorCount: results.filter(r => !r.success).length,
            results
        });
    } catch (error) {
        console.error('❌ [MONITOR] Erro ao escanear APIs:', (error as Error).message);
        res.status(500).json({
            success: false,
            error: (error as Error).message
        });
    }
});

// Rota para carregar resultados existentes
router.get('/results', async (req, res) => {
    try {
        // Em um ambiente real, isso viria de um banco de dados
        // Por enquanto, retornamos os resultados mais recentes do scan
        const mockResults = [];
        
        // Simular alguns resultados para demonstração
        for (let i = 0; i < apis.length; i++) {
            const api = apis[i];
            // Gerar resultados aleatórios para demonstração
            const isSuccess = Math.random() > 0.7; // 30% de sucesso para simular
            
            mockResults.push({
                name: api.name,
                url: api.url,
                method: api.method,
                status: isSuccess ? 'success' : 'error',
                statusCode: isSuccess ? 200 : (Math.random() > 0.5 ? 400 : 404),
                responseTime: Math.floor(Math.random() * 100) + 10,
                response: isSuccess ? 
                    { message: 'API funcionando', timestamp: new Date().toISOString() } :
                    { error: 'Erro simulado', timestamp: new Date().toISOString() }
            });
        }
        
        res.json({
            success: true,
            total: mockResults.length,
            successCount: mockResults.filter(r => r.status === 'success').length,
            errorCount: mockResults.filter(r => r.status === 'error').length,
            results: mockResults,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ [MONITOR] Erro ao carregar resultados:', (error as Error).message);
        res.status(500).json({
            success: false,
            error: (error as Error).message
        });
    }
});

// Rota para testar API individual
router.post('/test', async (req, res) => {
    try {
        const { url, method } = req.body;
        const api = apis.find(a => a.url === url && a.method === method);
        
        if (!api) {
            return res.status(404).json({
                success: false,
                error: 'API não encontrada'
            });
        }
        
        const result = await testAPI(api);
        res.json(result);
    } catch (error) {
        console.error('❌ [MONITOR] Erro ao testar API:', (error as Error).message);
        res.status(500).json({
            success: false,
            error: (error as Error).message
        });
    }
});

export default router;
