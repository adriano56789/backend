"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCollectionStats = exports.documentExists = exports.getDistinctValues = exports.aggregateDocuments = exports.deleteAllDocuments = exports.deleteManyDocuments = exports.deleteDocumentById = exports.pullFromArray = exports.pushToArray = exports.incrementField = exports.upsertDocument = exports.updateManyDocuments = exports.updateDocumentById = exports.findOneDocument = exports.countDocuments = exports.findDocuments = exports.findAllDocuments = exports.findDocumentById = exports.createManyDocuments = exports.createDocument = void 0;
const CrudService_1 = require("../services/CrudService");
// Helper para converter ServiceResponse para Response do Express
const handleServiceResponse = (res, serviceResponse, statusCode = 200) => {
    if (serviceResponse.success) {
        res.status(statusCode).json(serviceResponse);
    }
    else {
        res.status(400).json(serviceResponse);
    }
};
// === CREATE ===
const createDocument = async (req, res) => {
    const { collection } = req.params;
    const result = await CrudService_1.crudService.createDocument(collection, req.body);
    handleServiceResponse(res, result, 201);
};
exports.createDocument = createDocument;
const createManyDocuments = async (req, res) => {
    const { collection } = req.params;
    const { documents } = req.body;
    const result = await CrudService_1.crudService.createManyDocuments(collection, documents);
    handleServiceResponse(res, result, 201);
};
exports.createManyDocuments = createManyDocuments;
// === READ ===
const findDocumentById = async (req, res) => {
    const { collection, id } = req.params;
    const result = await CrudService_1.crudService.findDocumentById(collection, id);
    handleServiceResponse(res, result);
};
exports.findDocumentById = findDocumentById;
const findAllDocuments = async (req, res) => {
    const { collection } = req.params;
    const { page = 1, limit = 10, sort, filter, select } = req.query;
    // Parse query parameters
    const options = {
        page: parseInt(page),
        limit: parseInt(limit)
    };
    if (sort && typeof sort === 'string') {
        try {
            options.sort = JSON.parse(sort);
        }
        catch (e) {
            return res.status(400).json({
                success: false,
                error: 'Sort inválido',
                message: 'Sort inválido'
            });
        }
    }
    if (filter && typeof filter === 'string') {
        try {
            options.filter = JSON.parse(filter);
        }
        catch (e) {
            return res.status(400).json({
                success: false,
                error: 'Filtro inválido',
                message: 'Filtro inválido'
            });
        }
    }
    if (select && typeof select === 'string') {
        try {
            options.select = JSON.parse(select);
        }
        catch (e) {
            return res.status(400).json({
                success: false,
                error: 'Select inválido',
                message: 'Select inválido'
            });
        }
    }
    const result = await CrudService_1.crudService.findAllDocuments(collection, options);
    handleServiceResponse(res, result);
};
exports.findAllDocuments = findAllDocuments;
const findDocuments = async (req, res) => {
    const { collection } = req.params;
    const { filter, limit, sort, select, skip } = req.query;
    const options = {};
    if (filter && typeof filter === 'string') {
        try {
            options.filter = JSON.parse(filter);
        }
        catch (e) {
            return res.status(400).json({
                success: false,
                error: 'Filtro inválido',
                message: 'Filtro inválido'
            });
        }
    }
    if (limit)
        options.limit = parseInt(limit);
    if (skip)
        options.skip = parseInt(skip);
    if (sort && typeof sort === 'string') {
        try {
            options.sort = JSON.parse(sort);
        }
        catch (e) {
            return res.status(400).json({
                success: false,
                error: 'Sort inválido',
                message: 'Sort inválido'
            });
        }
    }
    if (select && typeof select === 'string') {
        try {
            options.select = JSON.parse(select);
        }
        catch (e) {
            return res.status(400).json({
                success: false,
                error: 'Select inválido',
                message: 'Select inválido'
            });
        }
    }
    const result = await CrudService_1.crudService.findDocuments(collection, options);
    handleServiceResponse(res, result);
};
exports.findDocuments = findDocuments;
const countDocuments = async (req, res) => {
    const { collection } = req.params;
    const { filter } = req.query;
    let mongoFilter = {};
    if (filter && typeof filter === 'string') {
        try {
            mongoFilter = JSON.parse(filter);
        }
        catch (e) {
            return res.status(400).json({
                success: false,
                error: 'Filtro inválido',
                message: 'Filtro inválido'
            });
        }
    }
    const result = await CrudService_1.crudService.countDocuments(collection, mongoFilter);
    handleServiceResponse(res, result);
};
exports.countDocuments = countDocuments;
const findOneDocument = async (req, res) => {
    const { collection } = req.params;
    const { field, value } = req.query;
    if (!field || !value) {
        return res.status(400).json({
            success: false,
            error: 'Field e value são obrigatórios',
            message: 'Field e value são obrigatórios'
        });
    }
    let filterValue;
    try {
        filterValue = JSON.parse(value);
    }
    catch (e) {
        filterValue = value;
    }
    const result = await CrudService_1.crudService.findOneDocument(collection, field, filterValue);
    handleServiceResponse(res, result);
};
exports.findOneDocument = findOneDocument;
// === UPDATE ===
const updateDocumentById = async (req, res) => {
    const { collection, id } = req.params;
    const result = await CrudService_1.crudService.updateDocumentById(collection, id, req.body);
    handleServiceResponse(res, result);
};
exports.updateDocumentById = updateDocumentById;
const updateManyDocuments = async (req, res) => {
    const { collection } = req.params;
    const { filter, update } = req.body;
    if (!filter || !update) {
        return res.status(400).json({
            success: false,
            error: 'Filter e update são obrigatórios',
            message: 'Filter e update são obrigatórios'
        });
    }
    const result = await CrudService_1.crudService.updateManyDocuments(collection, filter, update);
    handleServiceResponse(res, result);
};
exports.updateManyDocuments = updateManyDocuments;
const upsertDocument = async (req, res) => {
    const { collection } = req.params;
    const { filter, update } = req.body;
    if (!filter || !update) {
        return res.status(400).json({
            success: false,
            error: 'Filter e update são obrigatórios',
            message: 'Filter e update são obrigatórios'
        });
    }
    const result = await CrudService_1.crudService.upsertDocument(collection, filter, update);
    handleServiceResponse(res, result);
};
exports.upsertDocument = upsertDocument;
const incrementField = async (req, res) => {
    const { collection, id } = req.params;
    const { field, value = 1 } = req.body;
    if (!field) {
        return res.status(400).json({
            success: false,
            error: 'Field é obrigatório',
            message: 'Field é obrigatório'
        });
    }
    const updateData = { $inc: { [field]: value } };
    const result = await CrudService_1.crudService.updateDocumentById(collection, id, updateData);
    handleServiceResponse(res, result);
};
exports.incrementField = incrementField;
const pushToArray = async (req, res) => {
    const { collection, id } = req.params;
    const { field, item } = req.body;
    if (!field || item === undefined) {
        return res.status(400).json({
            success: false,
            error: 'Field e item são obrigatórios',
            message: 'Field e item são obrigatórios'
        });
    }
    const updateData = { $push: { [field]: item } };
    const result = await CrudService_1.crudService.updateDocumentById(collection, id, updateData);
    handleServiceResponse(res, result);
};
exports.pushToArray = pushToArray;
const pullFromArray = async (req, res) => {
    const { collection, id } = req.params;
    const { field, item } = req.body;
    if (!field || item === undefined) {
        return res.status(400).json({
            success: false,
            error: 'Field e item são obrigatórios',
            message: 'Field e item são obrigatórios'
        });
    }
    const updateData = { $pull: { [field]: item } };
    const result = await CrudService_1.crudService.updateDocumentById(collection, id, updateData);
    handleServiceResponse(res, result);
};
exports.pullFromArray = pullFromArray;
// === DELETE ===
const deleteDocumentById = async (req, res) => {
    const { collection, id } = req.params;
    const result = await CrudService_1.crudService.deleteDocumentById(collection, id);
    handleServiceResponse(res, result);
};
exports.deleteDocumentById = deleteDocumentById;
const deleteManyDocuments = async (req, res) => {
    const { collection } = req.params;
    const { filter } = req.body;
    if (!filter) {
        return res.status(400).json({
            success: false,
            error: 'Filter é obrigatório',
            message: 'Filter é obrigatório'
        });
    }
    const result = await CrudService_1.crudService.deleteManyDocuments(collection, filter);
    handleServiceResponse(res, result);
};
exports.deleteManyDocuments = deleteManyDocuments;
const deleteAllDocuments = async (req, res) => {
    const { collection } = req.params;
    const result = await CrudService_1.crudService.deleteManyDocuments(collection, {});
    handleServiceResponse(res, result);
};
exports.deleteAllDocuments = deleteAllDocuments;
// === OPERAÇÕES ESPECIAIS ===
const aggregateDocuments = async (req, res) => {
    const { collection } = req.params;
    const { pipeline } = req.body;
    if (!Array.isArray(pipeline)) {
        return res.status(400).json({
            success: false,
            error: 'Pipeline deve ser um array',
            message: 'Pipeline deve ser um array'
        });
    }
    const result = await CrudService_1.crudService.aggregateDocuments(collection, pipeline);
    handleServiceResponse(res, result);
};
exports.aggregateDocuments = aggregateDocuments;
const getDistinctValues = async (req, res) => {
    const { collection } = req.params;
    const { field, filter } = req.query;
    if (!field) {
        return res.status(400).json({
            success: false,
            error: 'Field é obrigatório',
            message: 'Field é obrigatório'
        });
    }
    let mongoFilter = {};
    if (filter && typeof filter === 'string') {
        try {
            mongoFilter = JSON.parse(filter);
        }
        catch (e) {
            return res.status(400).json({
                success: false,
                error: 'Filtro inválido',
                message: 'Filtro inválido'
            });
        }
    }
    // Usar agregação para distinct values
    const pipeline = [
        { $match: mongoFilter },
        { $group: { _id: null, distinctValues: { $addToSet: `$${field}` } } },
        { $project: { _id: 0, data: '$distinctValues' } }
    ];
    const result = await CrudService_1.crudService.aggregateDocuments(collection, pipeline);
    if (result.success && result.data?.data) {
        const distinctResult = {
            success: true,
            data: result.data.data,
            message: `${result.data.data.length} valores distintos encontrados`
        };
        handleServiceResponse(res, distinctResult);
    }
    else {
        handleServiceResponse(res, result);
    }
};
exports.getDistinctValues = getDistinctValues;
const documentExists = async (req, res) => {
    const { collection, id } = req.params;
    const result = await CrudService_1.crudService.documentExists(collection, id);
    handleServiceResponse(res, result);
};
exports.documentExists = documentExists;
const getCollectionStats = async (req, res) => {
    const { collection } = req.params;
    // Usar agregação para stats
    const pipeline = [
        {
            $group: {
                _id: null,
                count: { $sum: 1 },
                avgObjSize: { $avg: { $bsonSize: '$$ROOT' } }
            }
        },
        {
            $project: {
                _id: 0,
                data: {
                    count: '$count',
                    avgObjSize: { $ifNull: ['$avgObjSize', 0] }
                }
            }
        }
    ];
    const result = await CrudService_1.crudService.aggregateDocuments(collection, pipeline);
    if (result.success && result.data?.data) {
        const statsResult = {
            success: true,
            data: {
                count: result.data.data.count || 0,
                size: 0, // Não disponível via agregação
                avgObjSize: result.data.data.avgObjSize || 0,
                storageSize: 0, // Não disponível via agregação
                indexes: 0, // Não disponível via agregação
                indexSizes: {} // Não disponível via agregação
            },
            message: `Estatísticas da coleção ${collection}`
        };
        handleServiceResponse(res, statsResult);
    }
    else {
        handleServiceResponse(res, result);
    }
};
exports.getCollectionStats = getCollectionStats;
