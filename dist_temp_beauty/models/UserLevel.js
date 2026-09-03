"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserLevel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const UserLevelSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, unique: true },
    currentLevel: { type: Number, default: 1, min: 1 },
    currentExp: { type: Number, default: 0, min: 0 },
    expForNextLevel: { type: Number, default: 100 },
    totalExp: { type: Number, default: 0, min: 0 },
    levelHistory: [{
            level: { type: Number, required: true },
            reachedAt: { type: Date, default: Date.now },
            expRequired: { type: Number, required: true }
        }],
    lastExpGain: {
        amount: { type: Number, default: 0 },
        reason: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now }
    }
}, { timestamps: true });
// userId index já criado via unique:true no schema
UserLevelSchema.index({ currentLevel: 1 });
UserLevelSchema.index({ totalExp: -1 });
UserLevelSchema.statics.calculateExpForLevel = function (level) {
    if (level <= 0)
        return 0;
    if (level <= 1)
        return 0;
    if (level <= 5) {
        const progressions = [0, 50, 100, 150, 200];
        return progressions[level - 1] || 50;
    }
    else if (level <= 10) {
        return 200 + (level - 5) * 100;
    }
    else if (level <= 15) {
        return 500 + (level - 10) * 150;
    }
    else if (level <= 20) {
        return 1250 + (level - 15) * 250;
    }
    else if (level <= 25) {
        return 2500 + (level - 20) * 500;
    }
    else if (level <= 30) {
        return 5000 + (level - 25) * 750;
    }
    else if (level <= 40) {
        return 8750 + (level - 30) * 1000;
    }
    else {
        return 18750 + (level - 40) * 1500;
    }
};
UserLevelSchema.methods.addExp = async function (amount, reason = '') {
    this.currentExp += amount;
    this.totalExp += amount;
    this.lastExpGain = {
        amount,
        reason,
        timestamp: new Date()
    };
    let leveledUp = false;
    let newLevels = [];
    while (this.currentExp >= this.expForNextLevel) {
        this.currentExp -= this.expForNextLevel;
        this.currentLevel++;
        const newExpForNext = this.constructor.calculateExpForLevel(this.currentLevel + 1);
        this.expForNextLevel = newExpForNext;
        this.levelHistory.push({
            level: this.currentLevel,
            reachedAt: new Date(),
            expRequired: this.expForNextLevel
        });
        newLevels.push(this.currentLevel);
        leveledUp = true;
    }
    await this.save();
    return {
        leveledUp,
        newLevels,
        currentLevel: this.currentLevel,
        currentExp: this.currentExp,
        expForNextLevel: this.expForNextLevel,
        totalExp: this.totalExp,
        progress: (this.currentExp / this.expForNextLevel) * 100
    };
};
UserLevelSchema.methods.getLevelInfo = function () {
    return {
        level: this.currentLevel,
        currentExp: this.currentExp,
        expForNextLevel: this.expForNextLevel,
        totalExp: this.totalExp,
        progress: Math.min((this.currentExp / this.expForNextLevel) * 100, 100),
        expNeeded: Math.max(0, this.expForNextLevel - this.currentExp),
        lastGain: this.lastExpGain,
        levelHistory: this.levelHistory.slice(-10),
        rank: this.currentLevel >= 50 ? 'Mestre' :
            this.currentLevel >= 20 ? 'Avançado' :
                this.currentLevel >= 10 ? 'Experiente' : 'Iniciante'
    };
};
exports.UserLevel = mongoose_1.default.model('UserLevel', UserLevelSchema);
