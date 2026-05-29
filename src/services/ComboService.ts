const STREAK_TIMEOUT_MS = 3000;
const CLEANUP_TIMEOUT_MS = 5000;

interface ComboState {
  repeatCount: number;
  lastGiftAt: number;
  multiplier: number;
  groupId: string;
  lastGiftId: string;
  lastGiftName: string;
  lastDiamondCount: number;
  cleanupTimer?: NodeJS.Timeout;
}

export interface ComboResult {
  repeatCount: number;
  repeatEnd: boolean;
  comboCount: number;
  groupId: string;
  multiplier: number;
}

export class ComboService {
  private static streaks = new Map<string, Map<string, ComboState>>();

  static processCombo(
    streamId: string,
    userId: string,
    userName: string,
    userAvatar: string,
    giftId: string,
    giftName: string,
    diamondCount: number,
    io: any,
  ): ComboResult {
    if (!streamId || streamId === 'unknown') {
      return { repeatCount: 1, repeatEnd: true, comboCount: 1, groupId: '', multiplier: 1 };
    }

    const now = Date.now();

    let room = this.streaks.get(streamId);
    if (!room) {
      room = new Map();
      this.streaks.set(streamId, room);
    }

    const prev = room.get(userId);
    const expired = !prev || (now - prev.lastGiftAt > STREAK_TIMEOUT_MS);

    let state: ComboState;

    if (expired) {
      if (prev) {
        if (prev.cleanupTimer) clearTimeout(prev.cleanupTimer);
        this._emitEnd(streamId, userId, userName, userAvatar, prev, io);
      }
      state = {
        repeatCount: 1,
        lastGiftAt: now,
        multiplier: 1,
        groupId: `${streamId}_${userId}_${now}`,
        lastGiftId: giftId,
        lastGiftName: giftName,
        lastDiamondCount: diamondCount,
      };
      room.set(userId, state);
    } else {
      state = prev;
      state.repeatCount = Math.min(state.repeatCount + 1, 50);
      state.lastGiftAt = now;
      state.lastGiftId = giftId;
      state.lastGiftName = giftName;
      state.lastDiamondCount = diamondCount;
      if (state.cleanupTimer) clearTimeout(state.cleanupTimer);
    }

    state.multiplier = Math.min(state.repeatCount, 10);

    state.cleanupTimer = setTimeout(() => {
      const r = this.streaks.get(streamId);
      if (r) {
        const s = r.get(userId);
        if (s) {
          this._emitEnd(streamId, userId, userName, userAvatar, s, io);
          r.delete(userId);
        }
      }
    }, CLEANUP_TIMEOUT_MS);

    this._emitUpdate(streamId, userId, userName, userAvatar, state, false, io);

    return {
      repeatCount: state.repeatCount,
      repeatEnd: false,
      comboCount: state.repeatCount,
      groupId: state.groupId,
      multiplier: state.multiplier,
    };
  }

  private static _emitUpdate(
    streamId: string, userId: string, userName: string, userAvatar: string,
    state: ComboState, repeatEnd: boolean, io: any,
  ) {
    const payload = {
      roomId: streamId,
      userId,
      userName,
      userAvatar,
      giftId: state.lastGiftId,
      giftName: state.lastGiftName,
      diamondCount: state.lastDiamondCount,
      repeatCount: state.repeatCount,
      repeatEnd,
      comboCount: state.repeatCount,
      groupId: state.groupId,
      multiplier: state.multiplier,
      timestamp: new Date().toISOString(),
    };

    io.to(streamId).emit('combo_update', payload);

    if (state.repeatCount >= 5 && !repeatEnd) {
      io.to(streamId).emit('combo_explosion', {
        ...payload,
        bonusValue: Math.floor(state.lastDiamondCount * (state.multiplier - 1)),
      });
    }
  }

  private static _emitEnd(
    streamId: string, userId: string, userName: string, userAvatar: string,
    state: ComboState, io: any,
  ) {
    this._emitUpdate(streamId, userId, userName, userAvatar, state, true, io);
  }

  static getStreak(streamId: string, userId: string): { repeatCount: number; multiplier: number } | null {
    const room = this.streaks.get(streamId);
    if (!room) return null;
    const state = room.get(userId);
    if (!state) return null;
    return { repeatCount: state.repeatCount, multiplier: state.multiplier };
  }

  static clearStream(streamId: string) {
    this.streaks.delete(streamId);
  }

  static clearUser(streamId: string, userId: string) {
    const room = this.streaks.get(streamId);
    if (room) room.delete(userId);
  }
}
