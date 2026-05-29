import { Request, Response } from 'express';
import { crudService, ServiceResponse } from '../services/CrudService';

// Helper para converter ServiceResponse para Response do Express
const handleServiceResponse = (res: Response, serviceResponse: ServiceResponse, statusCode: number = 200) => {
  if (serviceResponse.success) {
    res.status(statusCode).json(serviceResponse);
  } else {
    res.status(400).json(serviceResponse);
  }
};

// === CREATE ===

export const createDocument = async (req: Request, res: Response) => {
  const { collection } = req.params;
  const result = await crudService.createDocument(collection, req.body);
  handleServiceResponse(res, result, 201);
};

export const createManyDocuments = async (req: Request, res: Response) => {
  const { collection } = req.params;
  const { documents } = req.body;
  const result = await crudService.createManyDocuments(collection, documents);
  handleServiceResponse(res, result, 201);
};

// === READ ===

export const findDocumentById = async (req: Request, res: Response) => {
  const { collection, id } = req.params;
  const result = await crudService.findDocumentById(collection, id);
  handleServiceResponse(res, result);
};

export const findAllDocuments = async (req: Request, res: Response) => {
  const { collection } = req.params;
  const {
    page = 1,
    limit = 10,
    sort,
    filter,
    select
  } = req.query;

  // Parse query parameters
  const options: any = {
    page: parseInt(page as string),
    limit: parseInt(limit as string)
  };

  if (sort && typeof sort === 'string') {
    try {
      options.sort = JSON.parse(sort);
    } catch (e) {
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
    } catch (e) {
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
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'Select inválido',
        message: 'Select inválido'
      });
    }
  }

  const result = await crudService.findAllDocuments(collection, options);
  handleServiceResponse(res, result);
};

export const findDocuments = async (req: Request, res: Response) => {
  const { collection } = req.params;
  const { filter, limit, sort, select, skip } = req.query;

  const options: any = {};

  if (filter && typeof filter === 'string') {
    try {
      options.filter = JSON.parse(filter);
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'Filtro inválido',
        message: 'Filtro inválido'
      });
    }
  }

  if (limit) options.limit = parseInt(limit as string);
  if (skip) options.skip = parseInt(skip as string);

  if (sort && typeof sort === 'string') {
    try {
      options.sort = JSON.parse(sort);
    } catch (e) {
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
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'Select inválido',
        message: 'Select inválido'
      });
    }
  }

  const result = await crudService.findDocuments(collection, options);
  handleServiceResponse(res, result);
};

export const countDocuments = async (req: Request, res: Response) => {
  const { collection } = req.params;
  const { filter } = req.query;

  let mongoFilter: any = {};
  if (filter && typeof filter === 'string') {
    try {
      mongoFilter = JSON.parse(filter);
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'Filtro inválido',
        message: 'Filtro inválido'
      });
    }
  }

  const result = await crudService.countDocuments(collection, mongoFilter);
  handleServiceResponse(res, result);
};

export const findOneDocument = async (req: Request, res: Response) => {
  const { collection } = req.params;
  const { field, value } = req.query;

  if (!field || !value) {
    return res.status(400).json({
      success: false,
      error: 'Field e value são obrigatórios',
      message: 'Field e value são obrigatórios'
    });
  }

  let filterValue: any;
  try {
    filterValue = JSON.parse(value as string);
  } catch (e) {
    filterValue = value;
  }

  const result = await crudService.findOneDocument(collection, field as string, filterValue);
  handleServiceResponse(res, result);
};

// === UPDATE ===

export const updateDocumentById = async (req: Request, res: Response) => {
  const { collection, id } = req.params;
  const result = await crudService.updateDocumentById(collection, id, req.body);
  handleServiceResponse(res, result);
};

export const updateManyDocuments = async (req: Request, res: Response) => {
  const { collection } = req.params;
  const { filter, update } = req.body;

  if (!filter || !update) {
    return res.status(400).json({
      success: false,
      error: 'Filter e update são obrigatórios',
      message: 'Filter e update são obrigatórios'
    });
  }

  const result = await crudService.updateManyDocuments(collection, filter, update);
  handleServiceResponse(res, result);
};

export const upsertDocument = async (req: Request, res: Response) => {
  const { collection } = req.params;
  const { filter, update } = req.body;

  if (!filter || !update) {
    return res.status(400).json({
      success: false,
      error: 'Filter e update são obrigatórios',
      message: 'Filter e update são obrigatórios'
    });
  }

  const result = await crudService.upsertDocument(collection, filter, update);
  handleServiceResponse(res, result);
};

export const incrementField = async (req: Request, res: Response) => {
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
  const result = await crudService.updateDocumentById(collection, id, updateData);
  handleServiceResponse(res, result);
};

export const pushToArray = async (req: Request, res: Response) => {
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
  const result = await crudService.updateDocumentById(collection, id, updateData);
  handleServiceResponse(res, result);
};

export const pullFromArray = async (req: Request, res: Response) => {
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
  const result = await crudService.updateDocumentById(collection, id, updateData);
  handleServiceResponse(res, result);
};

// === DELETE ===

export const deleteDocumentById = async (req: Request, res: Response) => {
  const { collection, id } = req.params;
  const result = await crudService.deleteDocumentById(collection, id);
  handleServiceResponse(res, result);
};

export const deleteManyDocuments = async (req: Request, res: Response) => {
  const { collection } = req.params;
  const { filter } = req.body;

  if (!filter) {
    return res.status(400).json({
      success: false,
      error: 'Filter é obrigatório',
      message: 'Filter é obrigatório'
    });
  }

  const result = await crudService.deleteManyDocuments(collection, filter);
  handleServiceResponse(res, result);
};

export const deleteAllDocuments = async (req: Request, res: Response) => {
  const { collection } = req.params;
  const result = await crudService.deleteManyDocuments(collection, {});
  handleServiceResponse(res, result);
};

// === OPERAÇÕES ESPECIAIS ===

export const aggregateDocuments = async (req: Request, res: Response) => {
  const { collection } = req.params;
  const { pipeline } = req.body;

  if (!Array.isArray(pipeline)) {
    return res.status(400).json({
      success: false,
      error: 'Pipeline deve ser um array',
      message: 'Pipeline deve ser um array'
    });
  }

  const result = await crudService.aggregateDocuments(collection, pipeline);
  handleServiceResponse(res, result);
};

export const getDistinctValues = async (req: Request, res: Response) => {
  const { collection } = req.params;
  const { field, filter } = req.query;

  if (!field) {
    return res.status(400).json({
      success: false,
      error: 'Field é obrigatório',
      message: 'Field é obrigatório'
    });
  }

  let mongoFilter: any = {};
  if (filter && typeof filter === 'string') {
    try {
      mongoFilter = JSON.parse(filter);
    } catch (e) {
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

  const result = await crudService.aggregateDocuments(collection, pipeline);
  if (result.success && result.data?.data) {
    const distinctResult = {
      success: true,
      data: result.data.data,
      message: `${result.data.data.length} valores distintos encontrados`
    };
    handleServiceResponse(res, distinctResult);
  } else {
    handleServiceResponse(res, result);
  }
};

export const documentExists = async (req: Request, res: Response) => {
  const { collection, id } = req.params;
  const result = await crudService.documentExists(collection, id);
  handleServiceResponse(res, result);
};

export const getCollectionStats = async (req: Request, res: Response) => {
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

  const result = await crudService.aggregateDocuments(collection, pipeline);
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
  } else {
    handleServiceResponse(res, result);
  }
};
