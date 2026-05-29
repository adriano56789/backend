import { ObjectId } from 'mongodb';
import { Gift, IGift } from '../models/Gift';
import { User, IUser } from '../models/User';
import { getDb } from '../config/db';
import { BaseModel } from '../db/BaseModel';

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
const MODEL_MAP: { [key: string]: any } = {
  'gifts': Gift,
  'users': User,
};

// Interface para resposta padronizada
export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Interface para paginação
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort?: any;
  filter?: any;
  select?: string[];
}

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class CrudService {
  // Helper para validar nome da coleção
  private validateCollection(collection: string): boolean {
    return ALLOWED_COLLECTIONS.includes(collection.toLowerCase());
  }

  // Helper para obter conexão com o banco
  private getMongoDb() {
    return getDb();
  }

  // Helper para verificar se é uma classe Model (BaseModel subclass)
  private isModelClass(obj: any): boolean {
    return typeof obj === 'function' && obj.prototype instanceof BaseModel;
  }

  // Helper para obter coleção ou model
  private getCollectionOrModel(collection: string) {
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
  private successResponse<T>(data: T, message: string = 'Operação realizada com sucesso'): ServiceResponse<T> {
    return {
      success: true,
      data,
      message
    };
  }

  // Helper para resposta de erro
  private errorResponse(message: string): ServiceResponse {
    return {
      success: false,
      error: message,
      message
    };
  }

  // === CREATE ===

  async createDocument(collection: string, data: any): Promise<ServiceResponse> {
    try {
      if (!this.validateCollection(collection)) {
        return this.errorResponse('Coleção não permitida');
      }

      const documentData = { ...data, createdAt: new Date(), updatedAt: new Date() };
      const modelOrCollection = this.getCollectionOrModel(collection);

      let result;
      
      // Se for um Model Mongoose
      if (this.isModelClass(modelOrCollection)) {
        result = await modelOrCollection.create(documentData);
      } else {
        // Se for coleção direta
        result = await modelOrCollection.insertOne(documentData);
        const createdDocument = { _id: result.insertedId, ...documentData };
        return this.successResponse({
          data: createdDocument,
          insertedId: result.insertedId.toString()
        }, 'Documento criado com sucesso');
      }

      return this.successResponse({
        data: result,
        insertedId: result._id?.toString()
      }, 'Documento criado com sucesso');
    } catch (error: any) {
      console.error('Erro ao criar documento:', error);
      return this.errorResponse('Erro ao criar documento: ' + error.message);
    }
  }

  async createManyDocuments(collection: string, documents: any[]): Promise<ServiceResponse> {
    try {
      if (!this.validateCollection(collection)) {
        return this.errorResponse('Coleção não permitida');
      }

      if (!Array.isArray(documents)) {
        return this.errorResponse('Documents deve ser um array');
      }

      const documentsWithTimestamp = documents.map(doc => ({
        ...doc,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      const modelOrCollection = this.getCollectionOrModel(collection);

      let result: string | any[];
      
      // Se for um Model Mongoose
      if (this.isModelClass(modelOrCollection)) {
        result = await modelOrCollection.insertMany(documentsWithTimestamp);
      } else {
        // Se for coleção direta
        result = await modelOrCollection.insertMany(documentsWithTimestamp);
        return this.successResponse({
          data: documentsWithTimestamp.map((doc, index) => ({
            _id: (result as any).insertedIds[index],
            ...doc
          })),
          insertedIds: Object.values((result as any).insertedIds).map((id: any) => id.toString()),
          insertedCount: (result as any).insertedCount
        }, `${(result as any).insertedCount} documentos criados com sucesso`);
      }

      return this.successResponse({
        data: result,
        insertedCount: result.length
      }, `${result.length} documentos criados com sucesso`);
    } catch (error: any) {
      console.error('Erro ao criar múltiplos documentos:', error);
      return this.errorResponse('Erro ao criar documentos: ' + error.message);
    }
  }

  // === READ ===

  async findDocumentById(collection: string, id: string): Promise<ServiceResponse> {
    try {
      if (!this.validateCollection(collection)) {
        return this.errorResponse('Coleção não permitida');
      }

      const modelOrCollection = this.getCollectionOrModel(collection);
      let document;

      // Se for um Model Mongoose
      if (this.isModelClass(modelOrCollection)) {
        document = await modelOrCollection.findById(id);
      } else {
        // Se for coleção direta
        document = await modelOrCollection.findOne({ _id: new ObjectId(id) });
      }

      if (!document) {
        return this.successResponse(null, 'Documento não encontrado');
      }

      return this.successResponse(document, 'Documento encontrado com sucesso');
    } catch (error: any) {
      console.error('Erro ao buscar documento por ID:', error);
      return this.errorResponse('Erro ao buscar documento: ' + error.message);
    }
  }

  async findAllDocuments(collection: string, options: PaginationOptions = {}): Promise<ServiceResponse<PaginationResult<any>>> {
    try {
      if (!this.validateCollection(collection)) {
        return this.errorResponse('Coleção não permitida');
      }

      const {
        page = 1,
        limit = 10,
        sort,
        filter,
        select
      } = options;

      const modelOrCollection = this.getCollectionOrModel(collection);

      // Construir filtro
      let mongoFilter: any = {};
      if (filter) {
        mongoFilter = filter;
      }

      // Construir projeção
      let projection: any = {};
      if (select && Array.isArray(select)) {
        select.forEach((field: string) => {
          projection[field] = 1;
        });
      }

      // Construir ordenação
      let mongoSort: any = { createdAt: -1 };
      if (sort) {
        mongoSort = sort;
      }

      const pageNum = parseInt(page.toString());
      const limitNum = parseInt(limit.toString());
      const skip = (pageNum - 1) * limitNum;

      let documents: any[] = [];
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
      } else {
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
    } catch (error: any) {
      console.error('Erro ao listar documentos:', error);
      return this.errorResponse('Erro ao listar documentos: ' + error.message);
    }
  }

  async findDocuments(collection: string, options: any = {}): Promise<ServiceResponse> {
    try {
      if (!this.validateCollection(collection)) {
        return this.errorResponse('Coleção não permitida');
      }

      const { filter, limit, sort, select, skip } = options;
      const modelOrCollection = this.getCollectionOrModel(collection);

      // Construir filtro
      let mongoFilter: any = {};
      if (filter) {
        mongoFilter = filter;
      }

      // Construir projeção
      let projection: any = {};
      if (select && Array.isArray(select)) {
        select.forEach((field: string) => {
          projection[field] = 1;
        });
      }

      // Construir ordenação
      let mongoSort: any = {};
      if (sort) {
        mongoSort = sort;
      }

      const queryOptions: any = {};
      if (limit) queryOptions.limit = parseInt(limit.toString());
      if (skip) queryOptions.skip = parseInt(skip.toString());
      if (Object.keys(mongoSort).length > 0) queryOptions.sort = mongoSort;

      let documents: any[] = [];
      let count = 0;

      // Se for um Model Mongoose
      if (this.isModelClass(modelOrCollection)) {
        const query = modelOrCollection.find(mongoFilter, queryOptions);
        
        if (Object.keys(projection).length > 0) {
          query.select(projection);
        }
        
        documents = await query.exec();
        count = await modelOrCollection.countDocuments(mongoFilter);
      } else {
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
    } catch (error: any) {
      console.error('Erro ao buscar documentos:', error);
      return this.errorResponse('Erro ao buscar documentos: ' + error.message);
    }
  }

  async countDocuments(collection: string, filter: any = {}): Promise<ServiceResponse> {
    try {
      if (!this.validateCollection(collection)) {
        return this.errorResponse('Coleção não permitida');
      }

      const modelOrCollection = this.getCollectionOrModel(collection);
      let count: number;

      // Se for um Model Mongoose
      if (this.isModelClass(modelOrCollection)) {
        count = await modelOrCollection.countDocuments(filter);
      } else {
        // Se for coleção direta
        count = await modelOrCollection.countDocuments(filter);
      }

      return this.successResponse({ count }, `Total de ${count} documentos`);
    } catch (error: any) {
      console.error('Erro ao contar documentos:', error);
      return this.errorResponse('Erro ao contar documentos: ' + error.message);
    }
  }

  async findOneDocument(collection: string, field: string, value: any): Promise<ServiceResponse> {
    try {
      if (!this.validateCollection(collection)) {
        return this.errorResponse('Coleção não permitida');
      }

      if (!field || value === undefined) {
        return this.errorResponse('Field e value são obrigatórios');
      }

      const modelOrCollection = this.getCollectionOrModel(collection);
      const filter: any = {};
      filter[field] = value;

      let document;

      // Se for um Model Mongoose
      if (this.isModelClass(modelOrCollection)) {
        document = await modelOrCollection.findOne(filter);
      } else {
        // Se for coleção direta
        document = await modelOrCollection.findOne(filter);
      }

      return this.successResponse(document, document ? 'Documento encontrado' : 'Documento não encontrado');
    } catch (error: any) {
      console.error('Erro ao buscar documento por campo:', error);
      return this.errorResponse('Erro ao buscar documento: ' + error.message);
    }
  }

  // === UPDATE ===

  async updateDocumentById(collection: string, id: string, updateData: any): Promise<ServiceResponse> {
    try {
      if (!this.validateCollection(collection)) {
        return this.errorResponse('Coleção não permitida');
      }

      const data = { ...updateData, updatedAt: new Date() };
      const modelOrCollection = this.getCollectionOrModel(collection);

      let result;
      let updatedDocument;

      // Se for um Model Mongoose
      if (this.isModelClass(modelOrCollection)) {
        result = await modelOrCollection.findOneAndUpdate(
          { _id: id },
          { $set: data },
          { new: true }
        );
        
        if (!result) {
          return this.errorResponse('Documento não encontrado');
        }
        
        updatedDocument = result;
      } else {
        // Se for coleção direta
        result = await modelOrCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: data }
        );

        if (result.matchedCount === 0) {
          return this.errorResponse('Documento não encontrado');
        }

        // Buscar documento atualizado
        updatedDocument = await modelOrCollection.findOne({ _id: new ObjectId(id) });
      }

      return this.successResponse({
        data: updatedDocument,
        modifiedCount: result?.modifiedCount || 1
      }, 'Documento atualizado com sucesso');
    } catch (error: any) {
      console.error('Erro ao atualizar documento:', error);
      return this.errorResponse('Erro ao atualizar documento: ' + error.message);
    }
  }

  async updateManyDocuments(collection: string, filter: any, update: any): Promise<ServiceResponse> {
    try {
      if (!this.validateCollection(collection)) {
        return this.errorResponse('Coleção não permitida');
      }

      if (!filter || !update) {
        return this.errorResponse('Filter e update são obrigatórios');
      }

      const updateData = { ...update, updatedAt: new Date() };
      const modelOrCollection = this.getCollectionOrModel(collection);

      let result;

      // Se for um Model Mongoose
      if (this.isModelClass(modelOrCollection)) {
        result = await modelOrCollection.updateMany(filter, { $set: updateData });
      } else {
        // Se for coleção direta
        result = await modelOrCollection.updateMany(filter, { $set: updateData });
      }

      return this.successResponse({
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount
      }, `${result.modifiedCount} documentos atualizados`);
    } catch (error: any) {
      console.error('Erro ao atualizar múltiplos documentos:', error);
      return this.errorResponse('Erro ao atualizar documentos: ' + error.message);
    }
  }

  async upsertDocument(collection: string, filter: any, update: any): Promise<ServiceResponse> {
    try {
      if (!this.validateCollection(collection)) {
        return this.errorResponse('Coleção não permitida');
      }

      if (!filter || !update) {
        return this.errorResponse('Filter e update são obrigatórios');
      }

      const updateData = { 
        ...update, 
        updatedAt: new Date(),
        ...(update.$set ? { $set: { ...update.$set, updatedAt: new Date() } } : {})
      };

      const modelOrCollection = this.getCollectionOrModel(collection);

      let result;
      let document;

      // Se for um Model Mongoose
      if (this.isModelClass(modelOrCollection)) {
        result = await modelOrCollection.findOneAndUpdate(
          filter,
          { 
            $set: updateData,
            $setOnInsert: { createdAt: new Date() }
          },
          { upsert: true, new: true, runValidators: true }
        );
        
        document = result;
      } else {
        // Se for coleção direta
        result = await modelOrCollection.updateOne(
          filter,
          { 
            $set: updateData,
            $setOnInsert: { createdAt: new Date() }
          },
          { upsert: true }
        );

        // Buscar documento
        document = await modelOrCollection.findOne(filter);
      }

      return this.successResponse({
        data: document,
        upsertedId: (result as any).upsertedId ? (result as any).upsertedId.toString() : undefined,
        modifiedCount: result?.modifiedCount || 0,
        upsertedCount: (result as any)?.upsertedCount || 0
      }, (result as any)?.upsertedCount > 0 ? 'Documento criado com sucesso' : 'Documento atualizado com sucesso');
    } catch (error: any) {
      console.error('Erro no upsert:', error);
      return this.errorResponse('Erro no upsert: ' + error.message);
    }
  }

  // === DELETE ===

  async deleteDocumentById(collection: string, id: string): Promise<ServiceResponse> {
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
      } else {
        // Se for coleção direta
        result = await modelOrCollection.deleteOne({ _id: new ObjectId(id) });

        return this.successResponse({
          deletedCount: result.deletedCount
        }, result.deletedCount > 0 ? 'Documento excluído com sucesso' : 'Documento não encontrado');
      }
    } catch (error: any) {
      console.error('Erro ao excluir documento:', error);
      return this.errorResponse('Erro ao excluir documento: ' + error.message);
    }
  }

  async deleteManyDocuments(collection: string, filter: any): Promise<ServiceResponse> {
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
      } else {
        // Se for coleção direta
        result = await modelOrCollection.deleteMany(filter);
      }

      return this.successResponse({
        deletedCount: result.deletedCount
      }, `${result.deletedCount} documentos excluídos`);
    } catch (error: any) {
      console.error('Erro ao excluir múltiplos documentos:', error);
      return this.errorResponse('Erro ao excluir documentos: ' + error.message);
    }
  }

  // === OPERAÇÕES ESPECIAIS ===

  async aggregateDocuments(collection: string, pipeline: any[]): Promise<ServiceResponse> {
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
      } else {
        // Se for coleção direta
        result = await modelOrCollection.aggregate(pipeline);
      }

      const results = Array.isArray(result) ? result : await result.toArray();

      return this.successResponse({
        data: results
      }, `Agregação executada com sucesso. ${results.length} resultados.`);
    } catch (error: any) {
      console.error('Erro na agregação:', error);
      return this.errorResponse('Erro na agregação: ' + error.message);
    }
  }

  async documentExists(collection: string, id: string): Promise<ServiceResponse> {
    try {
      if (!this.validateCollection(collection)) {
        return this.errorResponse('Coleção não permitida');
      }

      const modelOrCollection = this.getCollectionOrModel(collection);
      let document;

      // Se for um Model Mongoose
      if (this.isModelClass(modelOrCollection)) {
        document = await modelOrCollection.exists({ _id: id });
      } else {
        // Se for coleção direta
        document = await modelOrCollection.findOne({ _id: new ObjectId(id) }, { projection: { _id: 1 } });
      }

      return this.successResponse({
        exists: !!document
      }, document ? 'Documento existe' : 'Documento não existe');
    } catch (error: any) {
      console.error('Erro ao verificar existência:', error);
      return this.errorResponse('Erro ao verificar existência: ' + error.message);
    }
  }
}

export const crudService = new CrudService();
