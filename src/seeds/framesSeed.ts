import { getDb } from '../config/db';
import { Frame } from '../models';

export async function seedFrames() {
  try {
    const db = await getDb();
    const framesCollection = db.collection('frames');

    // Verificar quantos frames já existem
    const existingFrames = await framesCollection.countDocuments({ isActive: true });
    
    if (existingFrames > 0) {
      console.log(`✅ [SEED-FRAMES] Já existem ${existingFrames} frames ativos. Pulando seed.`);
      return;
    }

    const framesData = [
      {
        name: 'Blue Crystal',
        price: 150,
        duration: 7,
        description: 'Um frame azul cristalino elegante',
        icon: '💎',
        image: 'https://picsum.photos/seed/frame-blue-crystal/400/400',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Rose Garden',
        price: 200,
        duration: 7,
        description: 'Um frame rosa floral',
        icon: '🌹',
        image: 'https://picsum.photos/seed/frame-rose-garden/400/400',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Celestial Crown',
        price: 300,
        duration: 7,
        description: 'Um frame celestial com coroa',
        icon: '👑',
        image: 'https://picsum.photos/seed/frame-celestial/400/400',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Copper Pearls',
        price: 180,
        duration: 7,
        description: 'Um frame com pérolas de cobre',
        icon: '💧',
        image: 'https://picsum.photos/seed/frame-copper/400/400',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Cosmic Fire',
        price: 250,
        duration: 7,
        description: 'Um frame com fogo cósmico',
        icon: '🔥',
        image: 'https://picsum.photos/seed/frame-cosmic/400/400',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Mystical Wings',
        price: 220,
        duration: 7,
        description: 'Um frame com asas místicas',
        icon: '✨',
        image: 'https://picsum.photos/seed/frame-mystical/400/400',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Neon Feathers',
        price: 170,
        duration: 7,
        description: 'Um frame com penas neon',
        icon: '🌈',
        image: 'https://picsum.photos/seed/frame-neon/400/400',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Ornate Magenta',
        price: 190,
        duration: 7,
        description: 'Um frame ornamentado magenta',
        icon: '🎀',
        image: 'https://picsum.photos/seed/frame-magenta/400/400',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Baroque Elegance',
        price: 280,
        duration: 7,
        description: 'Um frame barroco elegante',
        icon: '🏆',
        image: 'https://picsum.photos/seed/frame-baroque/400/400',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Inserir os frames
    const result = await framesCollection.insertMany(framesData as any);
    
    console.log(`✅ [SEED-FRAMES] ${result.insertedIds.length} frames inseridos com sucesso!`);
    
    // Log dos IDs inseridos
    Object.entries(result.insertedIds).forEach(([idx, id]) => {
      console.log(`  - Frame ${idx + 1}: ${framesData[idx as any].name} (ID: ${id})`);
    });

  } catch (error) {
    console.error('❌ [SEED-FRAMES] Erro ao popular frames:', error);
  }
}

export default seedFrames;
