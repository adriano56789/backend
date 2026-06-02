import { IUser } from '../models/User';
import { getRealUserId } from './idHelper';

/**
 * Padroniza a resposta do usuário garantindo que todos os campos esperados pelo frontend
 * estejam presentes com valores padrão adequados, mesmo quando não há dados.
 */
export function standardizeUserResponse(user: any): any {
    if (!user) {
        // Retorna estrutura padrão vazia se não houver usuário
        return {
            id: null, // ID real nulo se não houver usuário
            name: "",
            identification: "",
            avatarUrl: "",
            coverUrl: "",
            age: 0,
            gender: "not_specified",
            level: 1,
            xp: 0,
            rank: 1,
            
            photos: [],
            followersList: [],
            followingList: [],
            friendsList: [],
            blockedUsers: [],
            
            fans: 0,
            following: 0,
            diamonds: 0,
            earnings: 0,
            earnings_withdrawn: 0,
            enviados: 0,
            receptores: 0,
            
        };
    }
    
    // Garante que todos os campos obrigatórios existam com valores padrão
    // Usando ID REAL da API Externa (Dazoom/Zoom) como fonte principal
    return {
        id: getRealUserId(user),
        name: user.name || "",
        displayName: user.displayName || user.name || "",
        identification: user.identification || "",
        avatar: user.avatar,
        avatarUrl: user.avatarUrl || "",
        coverUrl: user.coverUrl || "",
        streamServerUrl: user.streamServerUrl || "",
        rtmpIngestUrl: user.rtmpIngestUrl || "",
        srtIngestUrl: user.srtIngestUrl || "",
        streamKey: user.streamKey || "",
        playbackUrl: user.playbackUrl || "",
        roomId: user.roomId || "",
        photos: user.photos || [],
        avatarImages: user.avatarImages || [],
        country: user.country || "",
        age: user.age || 0,
        gender: user.gender || "not_specified",
        level: user.level || 1,
        xp: user.xp || 0,
        rank: user.rank || 0,
        location: user.location || "",
        distance: user.distance || "",
        fans: user.fans || 0,
        following: user.following || 0,
        followingList: user.followingList || [],
        followersList: user.followersList || [],
        blockedUsers: user.blockedUsers || [],
        friendsList: user.friendsList || [],
        receptores: user.receptores || 0,
        enviados: user.enviados || 0,
        topFansAvatars: user.topFansAvatars || [],
        accountStatus: user.accountStatus || "active",
        isLive: user.isLive || false,
        isOnline: user.isOnline || false,
        lastSeen: user.lastSeen,
        currentStreamId: user.currentStreamId || "",
        diamonds: user.diamonds || 0,
        earnings: user.earnings || 0,
        earnings_withdrawn: user.earnings_withdrawn || 0,
        diamonds_purchased: user.diamonds_purchased || 0,
        withdrawal_method: user.withdrawal_method || null,
        bio: user.bio || "",
        obras: user.obras || [],
        curtidas: user.curtidas || [],
        birthday: user.birthday || "",
        residence: user.residence || "",
        emotional_status: user.emotional_status || "",
        tags: user.tags || [],
        profession: user.profession || "",
        isVIP: user.isVIP || false,
        vipSubscriptionDate: user.vipSubscriptionDate || "",
        vipExpirationDate: user.vipExpirationDate || "",
        isAvatarProtected: user.isAvatarProtected || false,
        activeFrameId: user.activeFrameId || null,
        ownedFrames: user.ownedFrames || [],
        chatPermission: user.chatPermission || "all",
        pipEnabled: user.pipEnabled !== undefined ? user.pipEnabled : true,
        locationPermission: user.locationPermission || "prompt",
        showActivityStatus: user.showActivityStatus !== undefined ? user.showActivityStatus : true,
        showLocation: user.showLocation !== undefined ? user.showLocation : true,
        privateStreamSettings: user.privateStreamSettings || {
            privateInvite: false,
            followersOnly: false,
            fansOnly: false,
            friendsOnly: false
        },
        platformEarnings: user.platformEarnings || 0,
        adminWithdrawalMethod: user.adminWithdrawalMethod || null,
        withdrawal_requests: user.withdrawal_requests || [],
        frameExpiration: user.frameExpiration || null,
        audioRecordingEnabled: user.audioRecordingEnabled || false,
        audioRecordingPermanent: user.audioRecordingPermanent || false,
        audioRecordingGrantedAt: user.audioRecordingGrantedAt || null,
        audioRecordingDeniedAt: user.audioRecordingDeniedAt || null,
        cameraAccessEnabled: user.cameraAccessEnabled || false,
        cameraAccessPermanent: user.cameraAccessPermanent || false,
        cameraAccessGrantedAt: user.cameraAccessGrantedAt || null,
        cameraAccessDeniedAt: user.cameraAccessDeniedAt || null,
        beautySettings: user.beautySettings || {
            smoothness: 0,
            brightness: 0,
            whitening: 0,
            contrast: 0,
            blush: 0,
            filter: 'natural',
            enabled: false
        },
        loginCount: user.loginCount || 0,
        lastLogin: user.lastLogin || null,
        profileViews: user.profileViews || 0,
        totalLives: user.totalLives || 0,
        livesJoined: user.livesJoined || 0,
        messagesSent: user.messagesSent || 0,
        searchesPerformed: user.searchesPerformed || 0,
        recentActivities: user.recentActivities || [],
        createdAt: user.createdAt || new Date(),
        updatedAt: user.updatedAt || new Date()
    };
}

/**
 * Padroniza uma lista de usuários aplicando a padronização individual
 */
export function standardizeUsersList(users: any[]): any[] {
    if (!Array.isArray(users)) {
        return [];
    }
    
    return users.map(user => standardizeUserResponse(user));
}
