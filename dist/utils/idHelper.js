"use strict";
/**
 * HELPER DE ID - REGRA ESTRITA ANTI-MONGODB ID
 *
 * 🚨 REGRA OBRIGATÓRIA:
 * - ID da API Externa (Dazoom/Zoom) = ÚNICO ID VÁLIDO
 * - MongoDB _id = BLOQUEADO como referência principal
 * - NUNCA expor MongoDB ID para frontend
 * - CONVERSÃO OBRIGATÓRIA de _id para ID real
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureRealId = exports.isExternalApiId = exports.getRealUserId = exports.updateUserByRealId = exports.findUserByAnyId = exports.findUserByRealId = exports.validateRealId = exports.isMongoObjectId = void 0;
/**
 * Verifica se um ID é ObjectId do MongoDB (24 chars hex)
 */
const isMongoObjectId = (value) => {
    return /^[a-fA-F0-9]{24}$/.test(value);
};
exports.isMongoObjectId = isMongoObjectId;
/**
 * VALIDAÇÃO ESTRITA: Apenas IDs da API externa são permitidos
 */
const validateRealId = (userId) => {
    if (!userId) {
        throw new Error('ID não fornecido');
    }
    if ((0, exports.isMongoObjectId)(userId)) {
        throw new Error(`🚫 MongoDB ID não permitido como referência principal: ${userId}`);
    }
    return userId;
};
exports.validateRealId = validateRealId;
/**
 * ENCONTRAR USUÁRIO - APENAS por ID Real
 * MongoDB ID é convertido automaticamente para ID real antes da busca
 */
const findUserByRealId = async (User, userId) => {
    if (!userId) {
        throw new Error('🚫 Não foi fornecido um argumento para userId');
    }
    // Se for MongoDB ID, converter para ID real primeiro
    if ((0, exports.isMongoObjectId)(userId)) {
        console.warn(`⚠️ [ID_HELPER] Convertendo MongoDB ID para ID real: ${userId}`);
        const user = await User.findById(userId);
        if (!user || !user.id) {
            throw new Error(`❌ Usuário com MongoDB ID ${userId} não encontrado ou sem ID real`);
        }
        userId = user.id;
    }
    // Buscar por nome (name = id, não existe id numérico)
    let user = await User.findOne({ name: { $regex: new RegExp(`^${userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
    // FALLBACK: buscar por identification se nome não encontrou
    if (!user) {
        console.log(`⚠️ [ID_HELPER] Nome não encontrado, tentando por identification: ${userId}`);
        user = await User.findOne({ identification: userId });
    }
    if (!user) {
        throw new Error(`❌ Usuário não encontrado com ID real: ${userId}`);
    }
    console.log(`✅ [ID_HELPER] Usuário encontrado por ID real: ${userId}`);
    return user;
};
exports.findUserByRealId = findUserByRealId;
/**
 * ENCONTRAR USUÁRIO POR QUALQUER ID (Backward Compatibility)
 * Mantido para legado, mas converte para ID real internamente
 */
const findUserByAnyId = async (User, userId) => {
    if (!userId) {
        console.log(`❌ [ID_HELPER] ID não fornecido`);
        return null;
    }
    try {
        return await (0, exports.findUserByRealId)(User, userId);
    }
    catch (error) {
        console.log(`❌ [ID_HELPER] Falha na busca por ID: ${userId} - ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
};
exports.findUserByAnyId = findUserByAnyId;
/**
 * ATUALIZAR USUÁRIO - OBRIGATORIAMENTE por ID Real
 * MongoDB ID é bloqueado - convertido automaticamente
 */
const updateUserByRealId = async (User, userId, updateData, options = { new: true }) => {
    if (!userId) {
        throw new Error('🚫 Não foi fornecido um argumento para userId');
    }
    if (!updateData) {
        throw new Error('🚫 Não foi fornecido um argumento para updateData');
    }
    // Buscar usuário (converte MongoDB ID para ID real automaticamente)
    let user;
    try {
        user = await (0, exports.findUserByRealId)(User, userId);
    }
    catch (error) {
        console.log(`⚠️ [ID_HELPER] Usuário não encontrado para atualização: ${userId} - tentando update direto`);
        // Se não encontrou, tenta update direto pelo userId passado
        const atomicUpdate = updateData.$set || updateData.$inc || updateData.$push || updateData.$pull
            ? updateData
            : { $set: updateData };
        return await User.findOneAndUpdate({ $or: [{ id: userId }, { name: userId }, { identification: userId }] }, atomicUpdate, { ...options, returnDocument: 'after' });
    }
    // SEMPRE usar nome como chave (name = id, não existe id numérico)
    console.log(`✅ [ID_HELPER] Atualizando usuário: ${user.name}`);
    // Garantir que os dados de atualização usam operadores atômicos do MongoDB ($set)
    const atomicUpdate = updateData.$set || updateData.$inc || updateData.$push || updateData.$pull
        ? updateData
        : { $set: updateData };
    return await User.findOneAndUpdate({ name: user.name }, // name é a chave real (id = name)
    atomicUpdate, { ...options, returnDocument: 'after' });
};
exports.updateUserByRealId = updateUserByRealId;
/**
 * OBTER ID REAL - OBRIGATÓRIO para resposta da API
 * NUNCA retornar MongoDB ID
 */
const getRealUserId = (user) => {
    if (!user) {
        throw new Error('🚫 Usuário não fornecido');
    }
    // PRIORIDADE 1: ID real (Dazoom/Zoom) - ÚNICA opção válida
    if (user.id && !(0, exports.isMongoObjectId)(user.id)) {
        return user.id;
    }
    // PRIORIDADE 2: Campo identification (se não for MongoDB ID)
    if (user.identification && !(0, exports.isMongoObjectId)(user.identification)) {
        return user.identification;
    }
    // Se for um documento Mongoose, tentar converter para objeto e pegar o 'id' virtual ou campo 'id'
    const userObj = typeof user.toObject === 'function' ? user.toObject() : user;
    if (userObj.id && !(0, exports.isMongoObjectId)(userObj.id)) {
        return userObj.id;
    }
    throw new Error('❌ Nenhum ID real encontrado para o usuário');
};
exports.getRealUserId = getRealUserId;
/**
 * VERIFICAR SE ID É DA API EXTERNA
 */
const isExternalApiId = (userId) => {
    return !(0, exports.isMongoObjectId)(userId) && userId.length > 0;
};
exports.isExternalApiId = isExternalApiId;
/**
 * CONVERSOR PARA BACKWARD COMPATIBILITY
 * Converte MongoDB ID para ID real quando necessário
 */
const ensureRealId = async (User, id) => {
    if ((0, exports.isExternalApiId)(id)) {
        return id; // Já é ID real
    }
    // Se é MongoDB ID, buscar usuário para obter ID real
    const user = await User.findById(id);
    if (!user || !user.id) {
        throw new Error('User not found or has no real ID');
    }
    return user.id;
};
exports.ensureRealId = ensureRealId;
