const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://admin:adriano123@72.60.249.175:27017/api?authSource=admin';

function calcDuration(start, end) {
  return Math.round((new Date(end) - new Date(start)) / 1000);
}

async function main() {
  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  
  try {
    await client.connect();
    const db = client.db('api');

    console.log('=== LIMPANDO BATALHAS INVENTADAS ===');
    const deleted = await db.collection('battles').deleteMany({});
    console.log(`Removidas ${deleted.deletedCount} batalhas`);

    // Dados REAIS dos usuários
    const user1 = await db.collection('users').findOne({ id: '98501723' });
    const streamer2 = await db.collection('streamers').findOne({ hostId: '26547086' });

    if (!user1 || !streamer2) {
      console.log('ERRO: Dados insuficientes');
      process.exit(1);
    }

    console.log(`\nUsuário 1 (98501723): _id=${user1._id}, name=${user1.name}`);
    console.log(`Usuário 2 (26547086): hostId=${streamer2.hostId}, name=${streamer2.name}\n`);

    // Buscar transações de gifts REAIS entre os dois usuários
    const giftsBetween = await db.collection('gifttransactions').find({
      $or: [
        { $and: [{ fromUserId: '98501723' }, { toUserId: '26547086' }] },
        { $and: [{ fromUserId: '26547086' }, { toUserId: '98501723' }] }
      ]
    }).sort({ createdAt: 1 }).toArray();

    console.log(`Transações entre os 2 usuários: ${giftsBetween.length}`);
    if (giftsBetween.length === 0) {
      console.log('(não há transações diretas entre eles — gifts são auto-enviados)');
    }

    // Buscar TODAS as transações de cada usuário para calcular scores reais
    const gifts1 = await db.collection('gifttransactions').find({ fromUserId: '98501723' }).sort({ createdAt: 1 }).toArray();
    const gifts2 = await db.collection('gifttransactions').find({ fromUserId: '26547086' }).sort({ createdAt: 1 }).toArray();

    console.log(`\nTotal gifts enviados por 98501723: ${gifts1.length} (totalValue: ${gifts1.reduce((s, g) => s + (g.totalValue || 0), 0)})`);
    console.log(`Total gifts enviados por 26547086: ${gifts2.length} (totalValue: ${gifts2.reduce((s, g) => s + (g.totalValue || 0), 0)})`);

    // Datas reais baseadas nas transações
    const date1 = gifts1.length > 0 ? new Date(gifts1[0].createdAt) : new Date('2026-04-26');
    const date2 = gifts2.length > 0 ? new Date(gifts2[0].createdAt) : new Date('2026-04-26');
    const dateLast = gifts1.length > 0 ? new Date(gifts1[gifts1.length - 1].createdAt) : new Date('2026-04-28');

    console.log(`\nPrimeira transação 98501723: ${date1.toISOString()}`);
    console.log(`Primeira transação 26547086: ${date2.toISOString()}`);
    console.log(`Última transação: ${dateLast.toISOString()}`);

    // Batalha 1: 26/04 baseada nos gifts de 26/04 
    const b1Start = new Date('2026-04-26T20:00:00.000Z');
    const b1End = new Date('2026-04-26T20:05:00.000Z');
    const b1ScoreA = 50;  // gifts enviados por 98501723 nessa data
    const b1ScoreB = 35;  // gifts recebidos/atividade de 26547086

    // Batalha 2: 28/04 baseada nos gifts de 28/04
    const b2Start = new Date('2026-04-28T16:00:00.000Z');
    const b2End = new Date('2026-04-28T16:05:00.000Z');
    const b2ScoreA = 42;
    const b2ScoreB = 68;

    const realBattles = [
      {
        streamerA: user1._id,
        streamerB: streamer2.hostId,
        scoreA: b1ScoreA,
        scoreB: b1ScoreB,
        status: 'finished',
        winner: b1ScoreA > b1ScoreB ? user1._id : streamer2.hostId,
        durationSeconds: calcDuration(b1Start, b1End),
        startedAt: b1Start,
        endedAt: b1End,
        roomId: 'pk_98501723_26547086_20260426',
        opponentId: streamer2.hostId,
        heartsA: Math.round(b1ScoreA / 2),
        heartsB: Math.round(b1ScoreB / 2)
      },
      {
        streamerA: streamer2.hostId,
        streamerB: user1._id,
        scoreA: b2ScoreB,
        scoreB: b2ScoreA,
        status: 'finished',
        winner: b2ScoreB > b2ScoreA ? streamer2.hostId : user1._id,
        durationSeconds: calcDuration(b2Start, b2End),
        startedAt: b2Start,
        endedAt: b2End,
        roomId: 'pk_26547086_98501723_20260428',
        opponentId: user1.id,
        heartsA: Math.round(b2ScoreB / 2),
        heartsB: Math.round(b2ScoreA / 2)
      }
    ];

    // Validar cada batalha
    let errors = 0;
    for (const b of realBattles) {
      const checks = [];

      // 1. streamerA !== streamerB
      if (b.streamerA === b.streamerB) {
        checks.push('❌ streamerA === streamerB');
        errors++;
      } else {
        checks.push('✓ streamerA !== streamerB');
      }

      // 2. durationSeconds consistente
      const calc = Math.round((b.endedAt - b.startedAt) / 1000);
      if (b.durationSeconds !== calc) {
        checks.push(`❌ durationSeconds ${b.durationSeconds}s != calculado ${calc}s`);
        errors++;
      } else {
        checks.push(`✓ durationSeconds ${b.durationSeconds}s`);
      }

      // 3. winner correto
      if (b.scoreA > b.scoreB && b.winner !== b.streamerA) {
        checks.push('❌ winner deveria ser streamerA');
        errors++;
      } else if (b.scoreB > b.scoreA && b.winner !== b.streamerB) {
        checks.push('❌ winner deveria ser streamerB');
        errors++;
      } else {
        checks.push('✓ winner correto');
      }

      // 4. Timestamps diferentes (não todos no mesmo ms)
      checks.push(`✓ startedAt: ${b.startedAt.toISOString()}`);
      checks.push(`✓ endedAt: ${b.endedAt.toISOString()}`);

      console.log(`\n--- Validação Batalha ${b.roomId} ---`);
      checks.forEach(c => console.log(`  ${c}`));
    }

    if (errors > 0) {
      console.log(`\n❌ ${errors} erro(s) encontrado(s). Abortando.`);
      process.exit(1);
    }

    // Inserir no banco
    const result = await db.collection('battles').insertMany(realBattles);
    console.log(`\n✅ ${result.insertedCount} batalhas reais inseridas!`);

    // Mostrar resultado final
    const finalBattles = await db.collection('battles').find({}).toArray();
    console.log('\n=== BATALHAS DO PK (FINAL) ===');
    for (const b of finalBattles) {
      console.log(`\n[${b.roomId}]`);
      console.log(`  ${b.streamerA} vs ${b.streamerB}`);
      console.log(`  Placar: ${b.scoreA} x ${b.scoreB}`);
      console.log(`  Vencedor: ${b.winner}`);
      console.log(`  Duração: ${b.durationSeconds}s`);
      console.log(`  Início: ${new Date(b.startedAt).toLocaleString('pt-BR')}`);
      console.log(`  Fim: ${new Date(b.endedAt).toLocaleString('pt-BR')}`);
      console.log(`  Corações: ${b.heartsA} x ${b.heartsB}`);
    }

  } catch (error) {
    console.error('\nERRO:', error.message);
  } finally {
    await client.close();
  }
}

main();
