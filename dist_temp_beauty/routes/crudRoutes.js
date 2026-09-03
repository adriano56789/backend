"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const idValidation_1 = require("../middleware/idValidation");
const crudController_1 = require("../controllers/crudController");
const router = express_1.default.Router();
// Middleware de autenticação para todas as rotas CRUD
router.use(auth_1.protect);
router.use(idValidation_1.validateAndConvertUserId);
// === CREATE ===
// Criar um documento
router.post('/:collection', crudController_1.createDocument);
// Criar múltiplos documentos
router.post('/:collection/many', crudController_1.createManyDocuments);
// === READ ===
// Buscar por ID
router.get('/:collection/:id', crudController_1.findDocumentById);
// Buscar todos (com paginação)
router.get('/:collection', crudController_1.findAllDocuments);
// Buscar com filtros avançados
router.get('/:collection/find', crudController_1.findDocuments);
// Contar documentos
router.get('/:collection/count', crudController_1.countDocuments);
// Buscar um documento por campo
router.get('/:collection/findOne', crudController_1.findOneDocument);
// Verificar se documento existe
router.get('/:collection/:id/exists', crudController_1.documentExists);
// Buscar estatísticas da coleção
router.get('/:collection/stats', crudController_1.getCollectionStats);
// === UPDATE ===
// Atualizar por ID
router.put('/:collection/:id', crudController_1.updateDocumentById);
// Atualizar múltiplos documentos
router.put('/:collection/many', crudController_1.updateManyDocuments);
// Upsert (atualizar ou criar)
router.post('/:collection/upsert', crudController_1.upsertDocument);
// Incrementar campo numérico
router.post('/:collection/:id/increment', crudController_1.incrementField);
// Adicionar item a array
router.post('/:collection/:id/push', crudController_1.pushToArray);
// Remover item de array
router.post('/:collection/:id/pull', crudController_1.pullFromArray);
// === DELETE ===
// Excluir por ID
router.delete('/:collection/:id', crudController_1.deleteDocumentById);
// Excluir múltiplos documentos
router.delete('/:collection/many', crudController_1.deleteManyDocuments);
// Excluir todos (cuidado!)
router.delete('/:collection/all', crudController_1.deleteAllDocuments);
// === OPERAÇÕES ESPECIAIS ===
// Agregação MongoDB
router.post('/:collection/aggregate', crudController_1.aggregateDocuments);
// Valores distintos
router.get('/:collection/distinct', crudController_1.getDistinctValues);
exports.default = router;
