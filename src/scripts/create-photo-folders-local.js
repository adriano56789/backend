// Script para criar estrutura de pastas para fotos no banco de dados (versão local)
const { MongoClient } = require('mongodb');

async function createPhotoFoldersLocal() {
  // Conectar ao MongoDB local
  const client = new MongoClient('mongodb://admin:adriano123@localhost:27017/api?authSource=admin');
  
  try {
    await client.connect();
    const db = client.db();
    
    console.log('📁 Criando estrutura de pastas para fotos (local)...');
    
    // 1. Pasta real para fotos gerais do usuário
    await db.collection('photo_folders').insertOne({
      id: 'photos_98501723',
      userId: '98501723',
      name: 'Minhas Fotos',
      path: process.env.BASE_URL ? `${process.env.BASE_URL}/uploads/photos/` : 'http://localhost:3000/uploads/photos/',
      type: 'user_photos',
      isPublic: false, // Privado - apenas do usuário
      photos: [
        process.env.BASE_URL ? `${process.env.BASE_URL}/uploads/photos/photo1.jpg` : 'http://localhost:3000/uploads/photos/photo1.jpg',
        process.env.BASE_URL ? `${process.env.BASE_URL}/uploads/photos/photo2.jpg` : 'http://localhost:3000/uploads/photos/photo2.jpg'
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // 2. Pasta real para avatares do usuário
    await db.collection('photo_folders').insertOne({
      id: 'avatars_98501723',
      userId: '98501723',
      name: 'Meus Avatares',
      path: process.env.BASE_URL ? `${process.env.BASE_URL}/uploads/avatars/` : 'http://localhost:3000/uploads/avatars/',
      type: 'user_avatars',
      isPublic: false, // Privado - apenas do usuário
      photos: [
        process.env.BASE_URL ? `${process.env.BASE_URL}/uploads/avatars/avatar_1776856917501-710897559.avif` : 'http://localhost:3000/uploads/avatars/avatar_1776856917501-710897559.avif',
        process.env.BASE_URL ? `${process.env.BASE_URL}/uploads/avatars/avatar_1777032415223-166616352.avif` : 'http://localhost:3000/uploads/avatars/avatar_1777032415223-166616352.avif',
        process.env.BASE_URL ? `${process.env.BASE_URL}/uploads/avatars/avatar_1777378693908-120168488.jpg` : 'http://localhost:3000/uploads/avatars/avatar_1777378693908-120168488.jpg'
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // 3. Pasta real para fotos de chat do usuário
    await db.collection('photo_folders').insertOne({
      id: 'chat_photos_98501723',
      userId: '98501723',
      name: 'Fotos do Chat',
      path: process.env.BASE_URL ? `${process.env.BASE_URL}/uploads/chat/` : 'http://localhost:3000/uploads/chat/',
      type: 'chat_photos',
      isPublic: false, // Privado - apenas do usuário
      photos: [
        process.env.BASE_URL ? `${process.env.BASE_URL}/uploads/chat/chat_1774544616161-705105611.jpg` : 'http://localhost:3000/uploads/chat/chat_1774544616161-705105611.jpg',
        process.env.BASE_URL ? `${process.env.BASE_URL}/uploads/chat/chat_1774551067151-736585173.jpg` : 'http://localhost:3000/uploads/chat/chat_1774551067151-736585173.jpg',
        process.env.BASE_URL ? `${process.env.BASE_URL}/uploads/chat/chat_1776754860279-820889402.avif` : 'http://localhost:3000/uploads/chat/chat_1776754860279-820889402.avif'
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log('✅ Estrutura de pastas reais criada com sucesso!');
    console.log('');
    console.log('📁 Pastas criadas para usuário 98501723:');
    console.log('  📸 photos_98501723 - Minhas Fotos');
    console.log('  👤 avatars_98501723 - Meus Avatares');
    console.log('  💬 chat_photos_98501723 - Fotos do Chat');
    console.log('');
    console.log('🌐 URLs das pastas (baseadas no ambiente):');
    console.log(`  ${process.env.BASE_URL ? `${process.env.BASE_URL}/uploads/photos/` : 'http://localhost:3000/uploads/photos/'}`);
    console.log(`  ${process.env.BASE_URL ? `${process.env.BASE_URL}/uploads/avatars/` : 'http://localhost:3000/uploads/avatars/'}`);
    console.log(`  ${process.env.BASE_URL ? `${process.env.BASE_URL}/uploads/chat/` : 'http://localhost:3000/uploads/chat/'}`);
    console.log('');
    console.log('📂 Arquivos encontrados:');
    console.log('  📸 /uploads/photos/ - (vazio)');
    console.log('  👤 /uploads/avatars/ - 23 arquivos de avatar');
    console.log('  💬 /uploads/chat/ - 7 arquivos de chat');
    console.log('');
    console.log('🔒 Todas as pastas são PRIVADAS - apenas do usuário');
    
  } catch (error) {
    console.error('❌ Erro ao criar pastas:', error);
  } finally {
    await client.close();
  }
}

// Executar script
createPhotoFoldersLocal();
