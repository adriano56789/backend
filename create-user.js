const mongoose = require('mongoose');

async function createUser() {
    try {
        await mongoose.connect('mongodb://localhost:27017/livego');
        console.log('Conectado ao MongoDB');

        const db = mongoose.connection.db;
        const users = db.collection('users');
        
        // Criar usuário com ID correto
        const userId = '90401782';
        const streamKey = `stream_${userId}`;
        const roomId = `room_${userId}`;
        const rtmpIngestUrl = `rtmp://72.60.249.175:1935/live/${streamKey}`;
        const srtIngestUrl = `srt://72.60.249.175:10000?streamid=${streamKey}`;
        const playbackUrl = `http://72.60.249.175:8080/live/${streamKey}.flv`;
        
        const newUser = {
            id: userId,
            email: 'adrianomdk5@gmail.com',
            password: '$2b$10$BqW9JDL2XXkriTyACaKicOgsRabvQJag96DNGAZ85/K2CGuQ4tWMe',
            identification: userId,
            name: 'adriano',
            avatarUrl: '',
            coverUrl: '',
            streamServerUrl: 'rtmp://72.60.249.175:1935/live',
            rtmpIngestUrl: rtmpIngestUrl,
            srtIngestUrl: srtIngestUrl,
            streamKey: streamKey,
            playbackUrl: playbackUrl,
            roomId: roomId,
            photos: [],
            country: 'br',
            age: 25,
            gender: 'male',
            level: 1,
            xp: 0,
            location: '',
            distance: '',
            fans: 0,
            following: 0,
            followingList: [],
            followersList: [],
            blockedUsers: [],
            friendsList: [],
            receptores: 0,
            enviados: 0,
            topFansAvatars: [],
            accountStatus: 'active',
            isLive: false,
            isOnline: false,
            diamonds: 1000,
            earnings: 0,
            earnings_withdrawn: 0,
            diamonds_purchased: 0,
            withdrawal_method: null,
            bio: '',
            obras: [],
            curtidas: [],
            birthday: '01/01/1990',
            residence: 'k',
            emotional_status: '0',
            tags: [],
            profession: '',
            isVIP: false,
            vipSubscriptionDate: null,
            vipExpirationDate: null,
            isAvatarProtected: false,
            activeFrameId: null,
            ownedFrames: [],
            chatPermission: 'all',
            pipEnabled: true,
            locationPermission: 'granted',
            showActivityStatus: true,
            showLocation: true,
            privateStreamSettings: {
                privateInvite: false,
                followersOnly: false,
                fansOnly: false,
                friendsOnly: false
            },
            platformEarnings: 0,
            adminWithdrawalMethod: null,
            withdrawal_requests: [],
            frameExpiration: null,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        // Inserir usuário
        const result = await users.insertOne(newUser);
        console.log('✅ Usuário criado com sucesso!');
        console.log('ID:', userId);
        console.log('StreamKey:', streamKey);
        console.log('RoomId:', roomId);
        
        process.exit(0);
    } catch (error) {
        console.error('Erro:', error);
        process.exit(1);
    }
}

createUser();
