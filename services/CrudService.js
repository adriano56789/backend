"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crudService = void 0;
const mongodb_1 = require("mongodb");
const Gift_1 = require("../models/Gift");
const User_1 = require("../models/User");
const db_1 = require("../config/db");
const BaseModel_1 = require("../db/BaseModel");
// Coleções permitidas para segurança
const ALLOWED_COLLECTIONS = [
    'users',
    'messages',
    'streamers',
    'followers',
    'friendships',
    'gifts',
    'purchases',
    'notifications',
    'settings',
    'photos',
    'likes',
    'visitors',
    'interactions',
    'orders',
    'payments',
    'wallets',
    'levels',
    'frames',
    'effects',
    'locations',
    'searches',
    'uploads',
    'manuals',
    'webhooks',
    'withdrawals',
    'transactions',
    'zoom',
    'userstatus',
    'virtualips',
    'appversions',
    'callinvitations',
    'livekit'
];
// Mapeamento de Models para coleções específicas
const MODEL_MAP = {
    'gifts': Gift_1.Gift,
    'users': User_1.User,
};
class CrudService {
    // Helper para validar nome da coleção
    validateCollection(collection) {
        return ALLOWED_COLLECTIONS.includes(collection.toLowerCase());
    }
    // Helper para obter conexão com o banco
    getMongoDb() {
        return (0, db_1.getDb)();
    }
    // Helper para verificar se é uma classe Model (BaseModel subclass)
    isModelClass(obj) {
        return typeof obj === 'function' && obj.prototype instanceof BaseModel_1.BaseModel;
    }
    // Helper para obter coleção ou model
    getCollectionOrModel(collection) {
        const normalizedCollection = collection.toLowerCase();
        // Se tiver um Model específico, usa ele
        if (MODEL_MAP[normalizedCollection]) {
            return MODEL_MAP[normalizedCollection];
        }
        // Senão, usa a coleção direta do MongoDB
        const db = this.getMongoDb();
        return db.collection(collection);
    }
    // Helper para resposta de sucesso
    successResponse(data, message = 'Operação realizada com sucesso') {
        return {
            success: true,
            data,
            message
        };
    }
    // Helper para resposta de erro
    errorResponse(message) {
        return {
            success: false,
            error: message,
            message
        };
    }
    // === CREATE ===
    async createDocument(collection, data) {
        try {
            if (!this.validateCollection(collection)) {
                return this.errorResponse('Coleção não permitida');
            }
            console.log(`📝 [CRUD-CREATE] Evento recebido para coleção: ${collection}`);
            const documentData = { ...data, createdAt: new Date(), updatedAt: new Date() };
            const modelOrCollection = this.getCollectionOrModel(collection);
            let result;
            console.log(`📤 [CRUD-CREATE] Enviando insert para o banco...`);
            // Se for um Model Mongoose
            if (this.isModelClass(modelOrCollection)) {
                result = await modelOrCollection.create(documentData);
            }
            else {
                // Se for coleção direta
                result = await modelOrCollection.insertOne(documentData);
                const createdDocument = { _id: result.insertedId, ...documentData };
                console.log(`✅ [CRUD-CREATE] Resposta MongoDB recebida. Novo ID: ${result.insertedId}`);
                return this.successResponse({
                    data: createdDocument,
                    insertedId: result.insertedId.toString()
                }, 'Documento criado com sucesso');
            }
            console.log(`✅ [CRUD-CREATE] Resposta MongoDB recebida. Novo ID: ${result._id}`);
            return this.successResponse({
                data: result,
                insertedId: result._id?.toString()
            }, 'Documento criado com sucesso');
        }
        catch (error) {
            console.error('❌ [CRUD-CREATE] Erro ao criar documento:', error);
            return this.errorResponse('Erro ao criar documento: ' + error.message);
        }
    }
    async createManyDocuments(collection, documents) {
        try {
            if (!this.validateCollection(collection)) {
                return this.errorResponse('Coleção não permitida');
            }
            if (!Array.isArray(documents)) {
                return this.errorResponse('Documents deve ser um array');
            }
            console.log(`📝 [CRUD-CREATE-MANY] Evento recebido para coleção: ${collection} (${documents.length} documentos)`);
            const documentsWithTimestamp = documents.map(doc => ({
                ...doc,
                createdAt: new Date(),
                updatedAt: new Date()
            }));
            const modelOrCollection = this.getCollectionOrModel(collection);
            let result;
            console.log(`📤 [CRUD-CREATE-MANY] Enviando insertMany para o banco...`);
            // Se for um Model Mongoose
            if (this.isModelClass(modelOrCollection)) {
                result = await modelOrCollection.insertMany(documentsWithTimestamp);
            }
            else {
                // Se for coleção direta
                result = await modelOrCollection.insertMany(documentsWithTimestamp);
                console.log(`✅ [CRUD-CREATE-MANY] Resposta MongoDB recebida. Inseridos: ${result.insertedCount}`);
                return this.successResponse({
                    data: documentsWithTimestamp.map((doc, index) => ({
                        _id: result.insertedIds[index],
                        ...doc
                    })),
                    insertedIds: Object.values(result.insertedIds).map((id) => id.toString()),
                    insertedCount: result.insertedCount
                }, `${result.insertedCount} documentos criados com sucesso`);
            }
            console.log(`✅ [CRUD-CREATE-MANY] Resposta MongoDB recebida. Inseridos: ${result.length}`);
            return this.successResponse({
                data: result,
                insertedCount: result.length
            }, `${result.length} documentos criados com sucesso`);
        }
        catch (error) {
            console.error('❌ [CRUD-CREATE-MANY] Erro ao criar múltiplos documentos:', error);
            return this.errorResponse('Erro ao criar documentos: ' + error.message);
        }
    }
    // === READ ===
    async findDocumentById(collection, id) {
        try {
            if (!this.validateCollection(collection)) {
                return this.errorResponse('Coleção não permitida');
            }
            const modelOrCollection = this.getCollectionOrModel(collection);
            let document;
            // Se for um Model Mongoose
            if (this.isModelClass(modelOrCollection)) {
                document = await modelOrCollection.findById(id);
            }
            else {
                // Se for coleção direta
                document = await modelOrCollection.findOne({ _id: new mongodb_1.ObjectId(id) });
            }
            if (!document) {
                return this.successResponse(null, 'Documento não encontrado');
            }
            return this.successResponse(document, 'Documento encontrado com sucesso');
        }
        catch (error) {
            console.error('Erro ao buscar documento por ID:', error);
            return this.errorResponse('Erro ao buscar documento: ' + error.message);
        }
    }
    async findAllDocuments(collection, options = {}) {
        try {
            if (!this.validateCollection(collection)) {
                return this.errorResponse('Coleção não permitida');
            }
            const { page = 1, limit = 10, sort, filter, select } = options;
            const modelOrCollection = this.getCollectionOrModel(collection);
            // Construir filtro
            let mongoFilter = {};
            if (filter) {
                mongoFilter = filter;
            }
            // Construir projeção
            let projection = {};
            if (select && Array.isArray(select)) {
                select.forEach((field) => {
                    projection[field] = 1;
                });
            }
            // Construir ordenação
            let mongoSort = { createdAt: -1 };
            if (sort) {
                mongoSort = sort;
            }
            const pageNum = parseInt(page.toString());
            const limitNum = parseInt(limit.toString());
            const skip = (pageNum - 1) * limitNum;
            let documents = [];
            let total = 0;
            // Se for um Model Mongoose
            if (this.isModelClass(modelOrCollection)) {
                const query = modelOrCollection.find(mongoFilter);
                if (Object.keys(projection).length > 0) {
                    query.select(projection);
                }
                documents = await query
                    .sort(mongoSort)
                    .skip(skip)
                    .limit(limitNum)
                    .exec();
                total = await modelOrCollection.countDocuments(mongoFilter);
            }
            else {
                // Se for coleção direta
                documents = await modelOrCollection
                    .find(mongoFilter)
                    .project(projection)
                    .sort(mongoSort)
                    .skip(skip)
                    .limit(limitNum)
                    .toArray();
                total = await modelOrCollection.countDocuments(mongoFilter);
            }
            const totalPages = Math.ceil(total / limitNum);
            return this.successResponse({
                data: documents,
                total,
                page: pageNum,
                limit: limitNum,
                totalPages
            }, `${documents.length} documentos encontrados`);
        }
        catch (error) {
            console.error('Erro ao listar documentos:', error);
            return this.errorResponse('Erro ao listar documentos: ' + error.message);
        }
    }
    async findDocuments(collection, options = {}) {
        try {
            if (!this.validateCollection(collection)) {
                return this.errorResponse('Coleção não permitida');
            }
            const { filter, limit, sort, select, skip } = options;
            const modelOrCollection = this.getCollectionOrModel(collection);
            // Construir filtro
            let mongoFilter = {};
            if (filter) {
                mongoFilter = filter;
            }
            // Construir projeção
            let projection = {};
            if (select && Array.isArray(select)) {
                select.forEach((field) => {
                    projection[field] = 1;
                });
            }
            // Construir ordenação
            let mongoSort = {};
            if (sort) {
                mongoSort = sort;
            }
            const queryOptions = {};
            if (limit)
                queryOptions.limit = parseInt(limit.toString());
            if (skip)
                queryOptions.skip = parseInt(skip.toString());
            if (Object.keys(mongoSort).length > 0)
                queryOptions.sort = mongoSort;
            let documents = [];
            let count = 0;
            // Se for um Model Mongoose
            if (this.isModelClass(modelOrCollection)) {
                const query = modelOrCollection.find(mongoFilter, queryOptions);
                if (Object.keys(projection).length > 0) {
                    query.select(projection);
                }
                documents = await query.exec();
                count = await modelOrCollection.countDocuments(mongoFilter);
            }
            else {
                // Se for coleção direta
                documents = await modelOrCollection
                    .find(mongoFilter, queryOptions)
                    .project(projection)
                    .toArray();
                count = await modelOrCollection.countDocuments(mongoFilter);
            }
            return this.successResponse({
                data: documents,
                count
            }, `${documents.length} documentos encontrados`);
        }
        catch (error) {
            console.error('Erro ao buscar documentos:', error);
            return this.errorResponse('Erro ao buscar documentos: ' + error.message);
        }
    }
    async countDocuments(collection, filter = {}) {
        try {
            if (!this.validateCollection(collection)) {
                return this.errorResponse('Coleção não permitida');
            }
            const modelOrCollection = this.getCollectionOrModel(collection);
            let count;
            // Se for um Model Mongoose
            if (this.isModelClass(modelOrCollection)) {
                count = await modelOrCollection.countDocuments(filter);
            }
            else {
                // Se for coleção direta
                count = await modelOrCollection.countDocuments(filter);
            }
            return this.successResponse({ count }, `Total de ${count} documentos`);
        }
        catch (error) {
            console.error('Erro ao contar documentos:', error);
            return this.errorResponse('Erro ao contar documentos: ' + error.message);
        }
    }
    async findOneDocument(collection, field, value) {
        try {
            if (!this.validateCollection(collection)) {
                return this.errorResponse('Coleção não permitida');
            }
            if (!field || value === undefined) {
                return this.errorResponse('Field e value são obrigatórios');
            }
            const modelOrCollection = this.getCollectionOrModel(collection);
            const filter = {};
            filter[field] = value;
            let document;
            // Se for um Model Mongoose
            if (this.isModelClass(modelOrCollection)) {
                document = await modelOrCollection.findOne(filter);
            }
            else {
                // Se for coleção direta
                document = await modelOrCollection.findOne(filter);
            }
            return this.successResponse(document, document ? 'Documento encontrado' : 'Documento não encontrado');
        }
        catch (error) {
            console.error('Erro ao buscar documento por campo:', error);
            return this.errorResponse('Erro ao buscar documento: ' + error.message);
        }
    }
    // === UPDATE ===
    async updateDocumentById(collection, id, updateData) {
        try {
            if (!this.validateCollection(collection)) {
                return this.errorResponse('Coleção não permitida');
            }
            console.log(`📝 [CRUD-UPDATE] Evento de atualização recebido para ${collection} ID: ${id}`);
            const data = { ...updateData, updatedAt: new Date() };
            const modelOrCollection = this.getCollectionOrModel(collection);
            let result;
            let updatedDocument;
            console.log(`📤 [CRUD-UPDATE] Enviando update para o banco...`);
            // Se for um Model Mongoose
            if (this.isModelClass(modelOrCollection)) {
                result = await modelOrCollection.findOneAndUpdate({ _id: id }, { $set: data }, { returnDocument: 'after' });
                if (!result) {
                    console.warn(`⚠️ [CRUD-UPDATE] Documento não encontrado no banco.`);
                    return this.errorResponse('Documento não encontrado');
                }
                updatedDocument = result;
            }
            else {
                // Se for coleção direta
                result = await modelOrCollection.updateOne({ _id: new mongodb_1.ObjectId(id) }, { $set: data });
                if (result.matchedCount === 0) {
                    console.warn(`⚠️ [CRUD-UPDATE] Documento não encontrado no banco.`);
                    return this.errorResponse('Documento não encontrado');
                }
                // Buscar documento atualizado
                updatedDocument = await modelOrCollection.findOne({ _id: new mongodb_1.ObjectId(id) });
            }
            console.log(`✅ [CRUD-UPDATE] Resposta MongoDB recebida. Documento persistido com updatedAt: ${updatedDocument.updatedAt}`);
            return this.successResponse({
                data: updatedDocument,
                modifiedCount: result?.modifiedCount || 1
            }, 'Documento atualizado com sucesso');
        }
        catch (error) {
            console.error('❌ [CRUD-UPDATE] Erro ao atualizar documento:', error);
            return this.errorResponse('Erro ao atualizar documento: ' + error.message);
        }
    }
    async updateManyDocuments(collection, filter, update) {
        try {
            if (!this.validateCollection(collection)) {
                return this.errorResponse('Coleção não permitida');
            }
            if (!filter || !update) {
                return this.errorResponse('Filter e update são obrigatórios');
            }
            console.log(`📝 [CRUD-UPDATE-MANY] Evento recebido para coleção: ${collection}`);
            const updateData = { ...update, updatedAt: new Date() };
            const modelOrCollection = this.getCollectionOrModel(collection);
            let result;
            console.log(`📤 [CRUD-UPDATE-MANY] Enviando updateMany para o banco...`);
            // Se for um Model Mongoose
            if (this.isModelClass(modelOrCollection)) {
                result = await modelOrCollection.updateMany(filter, { $set: updateData });
            }
            else {
                // Se for coleção direta
                result = await modelOrCollection.updateMany(filter, { $set: updateData });
            }
            console.log(`✅ [CRUD-UPDATE-MANY] Resposta MongoDB recebida. Modificados: ${result.modifiedCount}`);
            return this.successResponse({
                modifiedCount: result.modifiedCount,
                matchedCount: result.matchedCount
            }, `${result.modifiedCount} documentos atualizados`);
        }
        catch (error) {
            console.error('❌ [CRUD-UPDATE-MANY] Erro ao atualizar múltiplos documentos:', error);
            return this.errorResponse('Erro ao atualizar documentos: ' + error.message);
        }
    }
    async upsertDocument(collection, filter, update) {
        try {
            if (!this.validateCollection(collection)) {
                return this.errorResponse('Coleção não permitida');
            }
            if (!filter || !update) {
                return this.errorResponse('Filter e update são obrigatórios');
            }
            console.log(`📝 [CRUD-UPSERT] Evento recebido para coleção: ${collection}`);
            const updateData = {
                ...update,
                updatedAt: new Date(),
                ...(update.$set ? { $set: { ...update.$set, updatedAt: new Date() } } : {})
            };
            const modelOrCollection = this.getCollectionOrModel(collection);
            let result;
            let document;
            console.log(`📤 [CRUD-UPSERT] Enviando upsert para o banco...`);
            // Se for um Model Mongoose
            if (this.isModelClass(modelOrCollection)) {
                result = await modelOrCollection.findOneAndUpdate(filter, {
                    $set: updateData,
                    $setOnInsert: { createdAt: new Date() }
                }, { upsert: true, returnDocument: 'after', runValidators: true });
                document = result;
            }
            else {
                // Se for coleção direta
                result = await modelOrCollection.updateOne(filter, {
                    $set: updateData,
                    $setOnInsert: { createdAt: new Date() }
                }, { upsert: true });
                // Buscar documento
                document = await modelOrCollection.findOne(filter);
            }
            console.log(`✅ [CRUD-UPSERT] Resposta MongoDB recebida. Novo valor persistido.`);
            return this.successResponse({
                data: document,
                upsertedId: result.upsertedId ? result.upsertedId.toString() : undefined,
                modifiedCount: result?.modifiedCount || 0,
                upsertedCount: result?.upsertedCount || 0
            }, result?.upsertedCount > 0 ? 'Documento criado com sucesso' : 'Documento atualizado com sucesso');
        }
        catch (error) {
            console.error('❌ [CRUD-UPSERT] Erro no upsert:', error);
            return this.errorResponse('Erro no upsert: ' + error.message);
        }
    }
    // === DELETE ===
    async deleteDocumentById(collection, id) {
        try {
            if (!this.validateCollection(collection)) {
                return this.errorResponse('Coleção não permitida');
            }
            const modelOrCollection = this.getCollectionOrModel(collection);
            let result;
            // Se for um Model Mongoose
            if (this.isModelClass(modelOrCollection)) {
                result = await modelOrCollection.findByIdAndDelete(id);
                return this.successResponse({
                    deletedCount: result ? 1 : 0
                }, result ? 'Documento excluído com sucesso' : 'Documento não encontrado');
            }
            else {
                // Se for coleção direta
                result = await modelOrCollection.deleteOne({ _id: new mongodb_1.ObjectId(id) });
                return this.successResponse({
                    deletedCount: result.deletedCount
                }, result.deletedCount > 0 ? 'Documento excluído com sucesso' : 'Documento não encontrado');
            }
        }
        catch (error) {
            console.error('Erro ao excluir documento:', error);
            return this.errorResponse('Erro ao excluir documento: ' + error.message);
        }
    }
    async deleteManyDocuments(collection, filter) {
        try {
            if (!this.validateCollection(collection)) {
                return this.errorResponse('Coleção não permitida');
            }
            if (!filter) {
                return this.errorResponse('Filter é obrigatório');
            }
            const modelOrCollection = this.getCollectionOrModel(collection);
            let result;
            // Se for um Model Mongoose
            if (this.isModelClass(modelOrCollection)) {
                result = await modelOrCollection.deleteMany(filter);
            }
            else {
                // Se for coleção direta
                result = await modelOrCollection.deleteMany(filter);
            }
            return this.successResponse({
                deletedCount: result.deletedCount
            }, `${result.deletedCount} documentos excluídos`);
        }
        catch (error) {
            console.error('Erro ao excluir múltiplos documentos:', error);
            return this.errorResponse('Erro ao excluir documentos: ' + error.message);
        }
    }
    // === OPERAÇÕES ESPECIAIS ===
    async aggregateDocuments(collection, pipeline) {
        try {
            if (!this.validateCollection(collection)) {
                return this.errorResponse('Coleção não permitida');
            }
            if (!Array.isArray(pipeline)) {
                return this.errorResponse('Pipeline deve ser um array');
            }
            const modelOrCollection = this.getCollectionOrModel(collection);
            let result;
            // Se for um Model Mongoose
            if (this.isModelClass(modelOrCollection)) {
                result = await modelOrCollection.aggregate(pipeline);
            }
            else {
                // Se for coleção direta
                result = await modelOrCollection.aggregate(pipeline);
            }
            const results = Array.isArray(result) ? result : await result.toArray();
            return this.successResponse({
                data: results
            }, `Agregação executada com sucesso. ${results.length} resultados.`);
        }
        catch (error) {
            console.error('Erro na agregação:', error);
            return this.errorResponse('Erro na agregação: ' + error.message);
        }
    }
    async documentExists(collection, id) {
        try {
            if (!this.validateCollection(collection)) {
                return this.errorResponse('Coleção não permitida');
            }
            const modelOrCollection = this.getCollectionOrModel(collection);
            let document;
            // Se for um Model Mongoose
            if (this.isModelClass(modelOrCollection)) {
                document = await modelOrCollection.exists({ _id: id });
            }
            else {
                // Se for coleção direta
                document = await modelOrCollection.findOne({ _id: new mongodb_1.ObjectId(id) }, { projection: { _id: 1 } });
            }
            return this.successResponse({
                exists: !!document
            }, document ? 'Documento existe' : 'Documento não existe');
        }
        catch (error) {
            console.error('Erro ao verificar existência:', error);
            return this.errorResponse('Erro ao verificar existência: ' + error.message);
        }
    }
}
exports.crudService = new CrudService();
