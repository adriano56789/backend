"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCollectionCheck = registerCollectionCheck;
exports.runDbValidation = runDbValidation;
exports.validateResponse = validateResponse;
const checks = [];
function registerCollectionCheck(name, model, apiEndpoint, critical = true, minDocs = 0) {
    checks.push({ name, model, apiEndpoint, critical, minDocs });
}
async function runDbValidation() {
    const warnings = [];
    const errors = [];
    for (const check of checks) {
        try {
            const count = await check.model.countDocuments({});
            if (count === 0) {
                const msg = `[DB-VALIDATION] Coleção "${check.name}" está VAZIA — API "${check.apiEndpoint}" retornará vazio`;
                if (check.critical) {
                    errors.push(msg);
                }
                else {
                    warnings.push(msg);
                }
            }
            else if (count < check.minDocs) {
                warnings.push(`[DB-VALIDATION] Coleção "${check.name}" tem apenas ${count} docs (mínimo esperado: ${check.minDocs})`);
            }
        }
        catch (err) {
            errors.push(`[DB-VALIDATION] Erro ao verificar coleção "${check.name}": ${err.message}`);
        }
    }
    return { ok: errors.length === 0, warnings, errors };
}
function validateResponse(endpoint, data, collectionName) {
    // Se a resposta tem arrays vazios, loga aviso com info da coleção
    const emptyArrays = [];
    function findEmptyArrays(obj, path) {
        if (!obj || typeof obj !== 'object')
            return;
        if (Array.isArray(obj) && obj.length === 0) {
            emptyArrays.push(path);
        }
        else if (typeof obj === 'object') {
            for (const key of Object.keys(obj)) {
                findEmptyArrays(obj[key], path ? `${path}.${key}` : key);
            }
        }
    }
    findEmptyArrays(data, '');
    if (emptyArrays.length > 0) {
        console.warn(`⚠️ [DB-VALIDATION] ${endpoint} retornou array(s) vazio(s): ${emptyArrays.join(', ')}. ` +
            `Verifique coleção "${collectionName}" no banco.`);
    }
}
