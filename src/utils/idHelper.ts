/**
 * HELPER DE ID - REGRA ESTRITA ANTI-MONGODB ID
 * 
 * 🚨 REGRA OBRIGATÓRIA:
 * - ID da API Externa (Dazoom/Zoom) = ÚNICO ID VÁLIDO
 * - MongoDB _id = BLOQUEADO como referência principal
 * - NUNCA expor MongoDB ID para frontend
 * - CONVERSÃO OBRIGATÓRIA de _id para ID real
 */

/**
 * Verifica se um ID é ObjectId do MongoDB (24 chars hex)
 */
export const isMongoObjectId = (value: string): boolean => {
    return /^[a-fA-F0-9]{24}$/.test(value);
};

/**
 * VALIDAÇÃO ESTRITA: Apenas IDs da API externa são permitidos
 */
export const validateRealId = (userId: string): string => {
    if (!userId) {
        throw new Error('ID não fornecido');
    }
    
    if (isMongoObjectId(userId)) {
        throw new Error(`🚫 MongoDB ID não permitido como referência principal: ${userId}`);
    }
    
    return userId;
};

/**
 * ENCONTRAR USUÁRIO - APENAS por ID Real
 * MongoDB ID é convertido automaticamente para ID real antes da busca
 */
export const findUserByRealId = async (User: any, userId: string) => {
    if (!userId) {
        throw new Error('🚫 Não foi fornecido um argumento para userId');
    }
    
    // Se for MongoDB ID, converter para ID real primeiro
    if (isMongoObjectId(userId)) {
        console.warn(`⚠️ [ID_HELPER] Convertendo MongoDB ID para ID real: ${userId}`);
        const user = await User.findById(userId);
        if (!user || !user.id) {
            throw new Error(`❌ Usuário com MongoDB ID ${userId} não encontrado ou sem ID real`);
        }
        userId = user.id;
    }
    
    // Buscar por id (campo numérico real do usuário)
    let user = await User.findOne({ id: userId });
    
    // FALLBACK 1: buscar por identification se id não encontrou
    if (!user) {
        console.log(`⚠️ [ID_HELPER] ID não encontrado, tentando por identification: ${userId}`);
        user = await User.findOne({ identification: userId });
    }
    
    // FALLBACK 2: buscar por nome (compatibilidade com dados antigos)
    if (!user) {
        console.log(`⚠️ [ID_HELPER] Identification não encontrado, tentando por nome: ${userId}`);
        user = await User.findOne({ name: { $regex: new RegExp(`^${userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
    }

    if (!user) {
        throw new Error(`❌ Usuário não encontrado com ID real: ${userId}`);
    }
    
    console.log(`✅ [ID_HELPER] Usuário encontrado por ID real: ${userId}`);
    return user;
};

/**
 * ENCONTRAR USUÁRIO POR QUALQUER ID (Backward Compatibility)
 * Mantido para legado, mas converte para ID real internamente
 */
export const findUserByAnyId = async (User: any, userId: string) => {
    if (!userId) {
        console.log(`❌ [ID_HELPER] ID não fornecido`);
        return null;
    }
    
    try {
        return await findUserByRealId(User, userId);
    } catch (error: unknown) {
        console.log(`❌ [ID_HELPER] Falha na busca por ID: ${userId} - ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
};

/**
 * ATUALIZAR USUÁRIO - OBRIGATORIAMENTE por ID Real
 * MongoDB ID é bloqueado - convertido automaticamente
 */
export const updateUserByRealId = async (User: any, userId: string, updateData: any, options: any = { returnDocument: 'after' }) => {
    if (!userId) {
        throw new Error('🚫 Não foi fornecido um argumento para userId');
    }
    
    if (!updateData) {
        throw new Error('🚫 Não foi fornecido um argumento para updateData');
    }
    
    // Buscar usuário (converte MongoDB ID para ID real automaticamente)
    let user;
    try {
        user = await findUserByRealId(User, userId);
    } catch (error: unknown) {
        console.log(`⚠️ [ID_HELPER] Usuário não encontrado para atualização: ${userId} - tentando update direto`);
        // Se não encontrou, tenta update direto pelo userId passado
        const atomicUpdate = updateData.$set || updateData.$inc || updateData.$push || updateData.$pull
            ? updateData
            : { $set: updateData };
        return await User.findOneAndUpdate(
            { $or: [{ id: userId }, { name: userId }, { identification: userId }] },
            atomicUpdate,
            { ...options, returnDocument: 'after' }
        );
    }
    
    // SEMPRE usar id como chave (campo numérico real)
    console.log(`✅ [ID_HELPER] Atualizando usuário: ${user.id}`);

    // Garantir que os dados de atualização usam operadores atômicos do MongoDB ($set)
    const atomicUpdate = updateData.$set || updateData.$inc || updateData.$push || updateData.$pull
        ? updateData
        : { $set: updateData };

    return await User.findOneAndUpdate(
        { id: user.id }, // id é a chave real (campo numérico)
        atomicUpdate,
        { ...options, returnDocument: 'after' }
    );
};

/**
 * OBTER ID REAL - OBRIGATÓRIO para resposta da API
 * NUNCA retornar MongoDB ID
 */
export const getRealUserId = (user: any): string => {
    if (!user) {
        throw new Error('🚫 Usuário não fornecido');
    }
    
    // PRIORIDADE 1: ID real (Dazoom/Zoom) - ÚNICA opção válida
    if (user.id && !isMongoObjectId(user.id)) {
        return user.id;
    }
    
    // PRIORIDADE 2: Campo identification (se não for MongoDB ID)
    if (user.identification && !isMongoObjectId(user.identification)) {
        return user.identification;
    }
    
    // Se for um documento Mongoose, tentar converter para objeto e pegar o 'id' virtual ou campo 'id'
    const userObj = typeof user.toObject === 'function' ? user.toObject() : user;
    if (userObj.id && !isMongoObjectId(userObj.id)) {
        return userObj.id;
    }

    throw new Error('❌ Nenhum ID real encontrado para o usuário');
};

/**
 * VERIFICAR SE ID É DA API EXTERNA
 */
export const isExternalApiId = (userId: string): boolean => {
    return !isMongoObjectId(userId) && userId.length > 0;
};

/**
 * CONVERSOR PARA BACKWARD COMPATIBILITY
 * Converte MongoDB ID para ID real quando necessário
 */
export const ensureRealId = async (User: any, id: string): Promise<string> => {
    if (isExternalApiId(id)) {
        return id; // Já é ID real
    }
    
    // Se é MongoDB ID, buscar usuário para obter ID real
    const user = await User.findById(id);
    if (!user || !user.id) {
        throw new Error('User not found or has no real ID');
    }
    
    return user.id;
};
