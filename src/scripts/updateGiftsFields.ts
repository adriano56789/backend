import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { Gift } from '../models';

/**
 * Script SEGURO: Apenas ATUALIZA os campos novos (videoUrl, audioUrl, duration, noBlend)
 * nos presentes que já existem no banco. NÃO apaga nada.
 */

function slug(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// Apenas presentes que TÊM campos extras para atualizar
const giftsUpdates: Record<string, { videoUrl?: string; audioUrl?: string; duration?: number; noBlend?: boolean; triggersAutoFollow?: boolean }> = {
  // === LUXO com vídeo ===
  'carro_esportivo':       { videoUrl: '', triggersAutoFollow: true },
  'joia_rara':             { videoUrl: '', triggersAutoFollow: true },
  'barco_a_vela':          { videoUrl: '', triggersAutoFollow: true },
  'navio_de_cruzeiro':     { videoUrl: '' },
  'joia':                  { videoUrl: '' },
  'telescopio':            { videoUrl: '' },
  'globo':                 { videoUrl: '' },
  'coroa':                 { videoUrl: '', triggersAutoFollow: true },

  // === VIP com vídeo ===
  'foguete':               { videoUrl: '', triggersAutoFollow: true },
  'jato_privado':          { videoUrl: '' },
  'anel':                  { videoUrl: '' },
  'leao':                  { videoUrl: '' },
  'carro':                 { videoUrl: '' },
  'fenix':                 { videoUrl: '' },
  'supercarro':            { videoUrl: '' },
  'dragao':                { videoUrl: '' },
  'castelo':               { videoUrl: '', triggersAutoFollow: true },
  'universo':              { videoUrl: '' },
  'helicoptero':           { videoUrl: '' },
  'planeta':               { videoUrl: '' },
  'iate':                  { videoUrl: '' },
  'galaxia':               { videoUrl: '' },
  'coroa_real':            { videoUrl: '' },
  'diamante_vip':          { videoUrl: '' },
  'ilha_particular':       { videoUrl: '' },
  'cavalo_alado':          { videoUrl: '' },
  'tigre_dourado':         { videoUrl: '' },
  'nave_espacial':         { videoUrl: '' },
  'estrela_cadente':       { videoUrl: '' },
  'cometa':                { videoUrl: '' },
  'buraco_negro':          { videoUrl: '' },
  'tesouro':               { videoUrl: '' },
  'pegaso':                { videoUrl: '' },
  'grifo':                 { videoUrl: '' },
  'hidra':                 { videoUrl: '' },
  'foguete_espacial':      { videoUrl: '' },
  'disco_voador':          { videoUrl: '' },
};

async function updateGiftsFields() {
  try {
    await connectDB();

    let updated = 0;
    let notFound = 0;
    let skipped = 0;

    for (const [giftId, fields] of Object.entries(giftsUpdates)) {
      // Só atualiza campos que NÃO são string vazia
      const updateFields: any = {};
      if (fields.videoUrl !== undefined && fields.videoUrl !== '') updateFields.videoUrl = fields.videoUrl;
      if (fields.audioUrl !== undefined && fields.audioUrl !== '') updateFields.audioUrl = fields.audioUrl;
      if (fields.duration !== undefined) updateFields.duration = fields.duration;
      if (fields.noBlend !== undefined) updateFields.noBlend = fields.noBlend;
      if (fields.triggersAutoFollow !== undefined) updateFields.triggersAutoFollow = fields.triggersAutoFollow;

      if (Object.keys(updateFields).length === 0) {
        skipped++;
        console.log(`⏭️  ${giftId} — sem campos para atualizar (preencha as URLs primeiro)`);
        continue;
      }

      const result = await Gift.updateOne(
        { id: giftId },
        { $set: updateFields }
      );

      if (result.matchedCount > 0) {
        updated++;
        console.log(`✅ ${giftId} — atualizado:`, Object.keys(updateFields).join(', '));
      } else {
        notFound++;
        console.log(`⚠️  ${giftId} — não encontrado no banco`);
      }
    }

    // Garantir que TODOS os presentes tenham noBlend = false se não tiver
    const bulkResult = await Gift.updateMany(
      { noBlend: { $exists: false } },
      { $set: { noBlend: false } }
    );
    console.log(`\n🔧 ${bulkResult.modifiedCount} presentes receberam noBlend: false (padrão)`);

    // Garantir triggersAutoFollow padrão
    const bulkResult2 = await Gift.updateMany(
      { triggersAutoFollow: { $exists: false } },
      { $set: { triggersAutoFollow: false } }
    );
    console.log(`🔧 ${bulkResult2.modifiedCount} presentes receberam triggersAutoFollow: false (padrão)`);

    console.log(`\n📊 Resumo:`);
    console.log(`   ✅ Atualizados: ${updated}`);
    console.log(`   ⏭️  Sem URL (preencher): ${skipped}`);
    console.log(`   ⚠️  Não encontrados: ${notFound}`);
    console.log(`\n💡 Para adicionar vídeos, edite este arquivo e coloque as URLs nos campos videoUrl/audioUrl`);
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado');
  }
}

updateGiftsFields();
