import express from 'express';
import { protect } from '../middleware/auth';
import { validateAndConvertUserId } from '../middleware/idValidation';
import { 
  createDocument, 
  createManyDocuments, 
  findDocumentById, 
  findAllDocuments, 
  findDocuments, 
  countDocuments, 
  findOneDocument,
  updateDocumentById, 
  updateManyDocuments, 
  upsertDocument,
  incrementField,
  pushToArray,
  pullFromArray,
  deleteDocumentById, 
  deleteManyDocuments, 
  deleteAllDocuments,
  aggregateDocuments,
  getDistinctValues,
  documentExists,
  getCollectionStats
} from '../controllers/crudController';

const router = express.Router();

// Middleware de autenticação para todas as rotas CRUD
router.use(protect);
router.use(validateAndConvertUserId);

// === CREATE ===

// Criar um documento
router.post('/:collection', createDocument);

// Criar múltiplos documentos
router.post('/:collection/many', createManyDocuments);

// === READ ===

// Buscar por ID
router.get('/:collection/:id', findDocumentById);

// Buscar todos (com paginação)
router.get('/:collection', findAllDocuments);

// Buscar com filtros avançados
router.get('/:collection/find', findDocuments);

// Contar documentos
router.get('/:collection/count', countDocuments);

// Buscar um documento por campo
router.get('/:collection/findOne', findOneDocument);

// Verificar se documento existe
router.get('/:collection/:id/exists', documentExists);

// Buscar estatísticas da coleção
router.get('/:collection/stats', getCollectionStats);

// === UPDATE ===

// Atualizar por ID
router.put('/:collection/:id', updateDocumentById);

// Atualizar múltiplos documentos
router.put('/:collection/many', updateManyDocuments);

// Upsert (atualizar ou criar)
router.post('/:collection/upsert', upsertDocument);

// Incrementar campo numérico
router.post('/:collection/:id/increment', incrementField);

// Adicionar item a array
router.post('/:collection/:id/push', pushToArray);

// Remover item de array
router.post('/:collection/:id/pull', pullFromArray);

// === DELETE ===

// Excluir por ID
router.delete('/:collection/:id', deleteDocumentById);

// Excluir múltiplos documentos
router.delete('/:collection/many', deleteManyDocuments);

// Excluir todos (cuidado!)
router.delete('/:collection/all', deleteAllDocuments);

// === OPERAÇÕES ESPECIAIS ===

// Agregação MongoDB
router.post('/:collection/aggregate', aggregateDocuments);

// Valores distintos
router.get('/:collection/distinct', getDistinctValues);

export default router;
