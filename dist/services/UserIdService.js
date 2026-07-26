"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserIdService = void 0;
const User_1 = require("../models/User");
class UserIdService {
    /**
     * Generate a unique 7-digit numeric ID
     * Follows the same pattern as authRoutes.ts registration
     */
    static async generateUniqueId() {
        let uniqueId = '';
        let exists = true;
        let attempts = 0;
        const maxAttempts = 100;
        while (exists && attempts < maxAttempts) {
            attempts++;
            const num = Math.floor(1000000 + Math.random() * 9000000);
            uniqueId = num.toString();
            const user = await User_1.User.findOne({ id: uniqueId }).select('_id').lean();
            if (!user) {
                exists = false;
            }
        }
        if (exists) {
            throw new Error('[USER-ID] Nao foi possivel gerar um ID unico apos ' + maxAttempts + ' tentativas');
        }
        return uniqueId;
    }
    /**
     * Validate if an ID is available (not taken by any user)
     */
    static async isIdAvailable(id) {
        if (!id || !/^\d{7}$/.test(id)) {
            return false;
        }
        const user = await User_1.User.findOne({ id }).select('_id').lean();
        return !user;
    }
    /**
     * Check if an ID exists and return the user if found
     */
    static async lookupUserById(id) {
        if (!id)
            return null;
        const user = await User_1.User.findOne({ id })
            .select('id name displayName avatarUrl email country level isLive isOnline')
            .lean();
        return user;
    }
    /**
     * Lookup user by ID and return basic public info
     */
    static async getPublicUserInfo(id) {
        const user = await this.lookupUserById(id);
        if (!user)
            return null;
        return {
            id: user.id,
            name: user.name,
            displayName: user.displayName || user.name,
            avatarUrl: user.avatarUrl || '',
            country: user.country || '',
            level: user.level || 1,
            isLive: user.isLive || false,
            isOnline: user.isOnline || false,
        };
    }
    /**
     * Assign (reserve) a specific ID for a user
     * Returns true if successful, false if ID already taken
     */
    static async assignIdToUser(userId, idToAssign) {
        const available = await this.isIdAvailable(idToAssign);
        if (!available)
            return false;
        const result = await User_1.User.findOneAndUpdate({ id: userId }, { $set: { id: idToAssign } }).lean();
        return !!result;
    }
    /**
     * Get ID usage statistics
     */
    static async getStats() {
        const [totalUsers, idRange] = await Promise.all([
            User_1.User.countDocuments(),
            User_1.User.aggregate([
                {
                    $match: {
                        id: { $regex: /^\d+$/ }
                    }
                },
                {
                    $group: {
                        _id: null,
                        minId: { $min: { $toInt: '$id' } },
                        maxId: { $max: { $toInt: '$id' } },
                        totalNumeric: { $sum: 1 }
                    }
                }
            ])
        ]);
        return {
            totalUsers,
            numericIds: idRange.length > 0 ? {
                count: idRange[0].totalNumeric,
                min: idRange[0].minId.toString(),
                max: idRange[0].maxId.toString(),
                range: `${idRange[0].minId} - ${idRange[0].maxId}`
            } : { count: 0, min: 'N/A', max: 'N/A', range: 'N/A' },
            availableSlots: idRange.length > 0 ? 9000000 - idRange[0].totalNumeric : 9000000
        };
    }
    /**
     * Batch generate multiple unique IDs
     */
    static async generateBatch(count) {
        const ids = [];
        for (let i = 0; i < count; i++) {
            const id = await this.generateUniqueId();
            ids.push(id);
        }
        return ids;
    }
}
exports.UserIdService = UserIdService;
