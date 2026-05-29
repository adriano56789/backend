const mongoose = require('mongoose');

async function setupDatabase() {
  try {
    // Conectar ao MongoDB sem especificar banco
    await mongoose.connect('mongodb://admin:adriano123@localhost:27017/admin?authSource=admin');
    console.log('✅ Conectado ao MongoDB');

    // Criar banco 'api' e usuário admin se não existir
    const db = mongoose.connection.db;
    
    // Testar criação de coleção para garantir que o banco existe
    await db.createCollection('test');
    console.log('✅ Banco "api" criado/acessado com sucesso');
    
    // Inserir documento de teste para verificar
    await db.collection('test').insertOne({
      message: 'Banco api configurado',
      timestamp: new Date()
    });
    console.log('✅ Documento de teste inserido');
    
    // Limpar coleção de teste
    await db.collection('test').drop();
    console.log('✅ Coleção de teste removida');
    
    console.log('🎉 Banco "api" está pronto para uso!');
    console.log('📋 Configurações:');
    console.log('   - Banco: api');
    console.log('   - Usuário: admin');
    console.log('   - Senha: adriano123');
    console.log('   - Auth Source: admin');
    
    mongoose.connection.close();
  } catch (error) {
    console.error('❌ Erro:', error.message);
    mongoose.connection.close();
  }
}

setupDatabase();
