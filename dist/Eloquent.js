// Import Relation classes
import { Relation, HasMany, HasOne, BelongsTo, BelongsToMany, MorphMany, MorphOne, MorphTo, MorphOneOfMany, HasManyThrough, HasOneThrough, } from './relations';
class QueryBuilder {
    debugLog(message, data) {
        if (Eloquent.debugEnabled) {
            Eloquent.debugLogger(message, data);
        }
    }
    constructor(model) {
        this.conditions = [];
        this.selectColumns = ['*'];
        this.isDistinct = false;
        this.joins = [];
        this.unions = [];
        this.orderByClauses = [];
        this.groupByColumns = [];
        this.havingConditions = [];
        this.trashedMode = 'default';
        this.selectBindings = [];
        this.model = model;
    }
    table(name) {
        this.tableName = name;
        return this;
    }
    select(...columns) {
        this.selectColumns = columns;
        return this;
    }
    addSelect(...columns) {
        this.selectColumns.push(...columns);
        return this;
    }
    distinct() {
        this.isDistinct = true;
        return this;
    }
    orderBy(column, direction = 'asc') {
        this.orderByClauses.push({ column, direction });
        return this;
    }
    orderByDesc(column) {
        return this.orderBy(column, 'desc');
    }
    latest(column = 'created_at') {
        return this.orderBy(column, 'desc');
    }
    oldest(column = 'created_at') {
        return this.orderBy(column, 'asc');
    }
    inRandomOrder() {
        this.orderByClauses.push({ column: 'RAND()', direction: 'asc' });
        return this;
    }
    groupBy(...columns) {
        this.groupByColumns.push(...columns);
        return this;
    }
    having(columnOrCallback, operator, value) {
        if (typeof columnOrCallback === 'function') {
            const subQuery = new QueryBuilder(this.model);
            columnOrCallback(subQuery);
            if (subQuery.conditions.length > 0) {
                this.havingConditions.push({ operator: 'AND', group: subQuery.conditions });
            }
        }
        else {
            const column = columnOrCallback;
            const op = operator || '=';
            const val = value;
            this.havingConditions.push({ operator: 'AND', type: 'basic', conditionOperator: op, column, value: val });
        }
        return this;
    }
    limit(value) {
        this.limitValue = value;
        return this;
    }
    offset(value) {
        this.offsetValue = value;
        return this;
    }
    tap(callback) {
        callback(this);
        return this;
    }
    async each(callback) {
        const results = await this.get();
        for (const item of results) {
            await callback(item);
        }
    }
    join(table, first, operator, second) {
        this.joins.push({ type: 'inner', table, first, operator, second });
        return this;
    }
    leftJoin(table, first, operator, second) {
        this.joins.push({ type: 'left', table, first, operator, second });
        return this;
    }
    rightJoin(table, first, operator, second) {
        this.joins.push({ type: 'right', table, first, operator, second });
        return this;
    }
    crossJoin(table) {
        this.joins.push({ type: 'cross', table });
        return this;
    }
    union(query) {
        this.unions.push({ query, all: false });
        return this;
    }
    unionAll(query) {
        this.unions.push({ query, all: true });
        return this;
    }
    async count(column = '*') {
        return this.aggregate('COUNT', column);
    }
    async max(column) {
        return this.aggregate('MAX', column);
    }
    async min(column) {
        return this.aggregate('MIN', column);
    }
    async avg(column) {
        return this.aggregate('AVG', column);
    }
    async sum(column) {
        return this.aggregate('SUM', column);
    }
    async exists() {
        const result = await this.count();
        return result > 0;
    }
    async doesntExist() {
        return !(await this.exists());
    }
    async pluck(column, key) {
        const results = await this.get();
        if (key) {
            return results.reduce((acc, row) => {
                acc[row[key]] = row[column];
                return acc;
            }, {});
        }
        else {
            return results.map((row) => row[column]);
        }
    }
    async value(column) {
        const row = await this.first();
        return row ? row[column] : null;
    }
    async find(id) {
        return this.where('id', id).first();
    }
    async findOrFail(id) {
        const result = await this.find(id);
        if (!result) {
            throw new Error(`Model not found with id: ${id}`);
        }
        return result;
    }
    async findOr(id, defaultValue) {
        const result = await this.find(id);
        if (result) {
            return result;
        }
        return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
    }
    // Removed write operations (insert, insertGetId, update, delete) to keep ORM read-only
    async aggregate(functionName, column) {
        // Check for Sushi - in-memory aggregate
        if (this.model.usesSushi()) {
            return this.aggregateSushi(functionName, column);
        }
        if (!Eloquent.connection)
            throw new Error('Database connection not initialized');
        const table = this.tableName || this.model.table || this.model.name.toLowerCase() + 's';
        let sql = `SELECT ${functionName}(${column}) as aggregate FROM ${table}`;
        const allConditions = this.conditions ? JSON.parse(JSON.stringify(this.conditions)) : [];
        // Apply global scopes
        const globalScopes = this.model.globalScopes;
        if (globalScopes) {
            for (const scope of globalScopes) {
                if (typeof scope === 'function') {
                    const scopeQuery = new QueryBuilder(this.model);
                    scope.call(this.model, scopeQuery);
                    if (scopeQuery.conditions.length > 0) {
                        allConditions.push({ operator: 'AND', group: scopeQuery.conditions });
                    }
                }
            }
        }
        const soft = this.model.softDeletes;
        if (soft) {
            if (this.trashedMode === 'default') {
                allConditions.push({ operator: 'AND', type: 'null', column: `${table}.deleted_at` });
            }
            else if (this.trashedMode === 'only') {
                allConditions.push({ operator: 'AND', type: 'not_null', column: `${table}.deleted_at` });
            }
        }
        const whereClause = allConditions.length > 0 ? this.buildWhereClause(allConditions) : { sql: '', params: [] };
        if (whereClause.sql)
            sql += ` WHERE ${whereClause.sql}`;
        // Debug logging
        this.debugLog('Executing aggregate query', { sql, params: whereClause.params, function: functionName, column });
        this.ensureReadOnlySql(sql, 'aggregate');
        const [rows] = await Eloquent.connection.query(sql, whereClause.params);
        const result = rows[0].aggregate;
        // Debug logging - aggregate completed
        this.debugLog('Aggregate query completed', { function: functionName, column, result });
        return result;
    }
    where(columnOrCallback, operatorOrValue, value) {
        if (typeof columnOrCallback === 'function') {
            const subQuery = new QueryBuilder(this.model);
            columnOrCallback(subQuery);
            if (subQuery.conditions.length > 0) {
                this.conditions.push({ operator: 'AND', group: subQuery.conditions });
            }
        }
        else {
            const column = columnOrCallback;
            let conditionOperator;
            let val;
            if (value !== undefined) {
                conditionOperator = operatorOrValue;
                val = value;
            }
            else {
                conditionOperator = '=';
                val = operatorOrValue;
            }
            this.conditions.push({ operator: 'AND', type: 'basic', conditionOperator, column, value: val });
        }
        return this;
    }
    orWhere(columnOrCallback, operatorOrValue, value) {
        if (typeof columnOrCallback === 'function') {
            const subQuery = new QueryBuilder(this.model);
            columnOrCallback(subQuery);
            this.conditions.push({ operator: 'OR', group: subQuery.conditions });
        }
        else {
            const column = columnOrCallback;
            let conditionOperator;
            let val;
            if (value !== undefined) {
                conditionOperator = operatorOrValue;
                val = value;
            }
            else {
                conditionOperator = '=';
                val = operatorOrValue;
            }
            this.conditions.push({ operator: 'OR', type: 'basic', conditionOperator, column, value: val });
        }
        return this;
    }
    whereIn(column, values) {
        this.conditions.push({ operator: 'AND', type: 'in', column, value: values });
        return this;
    }
    whereNotIn(column, values) {
        this.conditions.push({ operator: 'AND', type: 'not_in', column, value: values });
        return this;
    }
    orWhereIn(column, values) {
        this.conditions.push({ operator: 'OR', type: 'in', column, value: values });
        return this;
    }
    orWhereNotIn(column, values) {
        this.conditions.push({ operator: 'OR', type: 'not_in', column, value: values });
        return this;
    }
    whereNull(column) {
        this.conditions.push({ operator: 'AND', type: 'null', column });
        return this;
    }
    whereNotNull(column) {
        this.conditions.push({ operator: 'AND', type: 'not_null', column });
        return this;
    }
    orWhereNull(column) {
        this.conditions.push({ operator: 'OR', type: 'null', column });
        return this;
    }
    orWhereNotNull(column) {
        this.conditions.push({ operator: 'OR', type: 'not_null', column });
        return this;
    }
    whereBetween(column, values) {
        this.conditions.push({ operator: 'AND', type: 'between', column, value: values });
        return this;
    }
    whereNotBetween(column, values) {
        this.conditions.push({ operator: 'AND', type: 'not_between', column, value: values });
        return this;
    }
    orWhereBetween(column, values) {
        this.conditions.push({ operator: 'OR', type: 'between', column, value: values });
        return this;
    }
    orWhereNotBetween(column, values) {
        this.conditions.push({ operator: 'OR', type: 'not_between', column, value: values });
        return this;
    }
    // Date-based where clauses
    whereDate(column, operatorOrValue, value) {
        if (value === undefined) {
            this.conditions.push({ operator: 'AND', type: 'raw', sql: `DATE(${column}) = ?`, bindings: [operatorOrValue] });
        }
        else {
            this.conditions.push({ operator: 'AND', type: 'raw', sql: `DATE(${column}) ${operatorOrValue} ?`, bindings: [value] });
        }
        return this;
    }
    whereMonth(column, operatorOrValue, value) {
        if (value === undefined) {
            this.conditions.push({ operator: 'AND', type: 'raw', sql: `MONTH(${column}) = ?`, bindings: [operatorOrValue] });
        }
        else {
            this.conditions.push({ operator: 'AND', type: 'raw', sql: `MONTH(${column}) ${operatorOrValue} ?`, bindings: [value] });
        }
        return this;
    }
    whereYear(column, operatorOrValue, value) {
        if (value === undefined) {
            this.conditions.push({ operator: 'AND', type: 'raw', sql: `YEAR(${column}) = ?`, bindings: [operatorOrValue] });
        }
        else {
            this.conditions.push({ operator: 'AND', type: 'raw', sql: `YEAR(${column}) ${operatorOrValue} ?`, bindings: [value] });
        }
        return this;
    }
    whereDay(column, operatorOrValue, value) {
        if (value === undefined) {
            this.conditions.push({ operator: 'AND', type: 'raw', sql: `DAY(${column}) = ?`, bindings: [operatorOrValue] });
        }
        else {
            this.conditions.push({ operator: 'AND', type: 'raw', sql: `DAY(${column}) ${operatorOrValue} ?`, bindings: [value] });
        }
        return this;
    }
    whereTime(column, operatorOrValue, value) {
        if (value === undefined) {
            this.conditions.push({ operator: 'AND', type: 'raw', sql: `TIME(${column}) = ?`, bindings: [operatorOrValue] });
        }
        else {
            this.conditions.push({ operator: 'AND', type: 'raw', sql: `TIME(${column}) ${operatorOrValue} ?`, bindings: [value] });
        }
        return this;
    }
    // whereNot - negate a condition or group
    whereNot(columnOrCallback, operatorOrValue, value) {
        if (typeof columnOrCallback === 'function') {
            // Group negation
            const subQuery = new QueryBuilder(this.model);
            columnOrCallback(subQuery);
            if (subQuery.conditions.length > 0) {
                this.conditions.push({ operator: 'AND', type: 'raw', sql: 'NOT', bindings: [] });
                this.conditions.push({ operator: 'AND', group: subQuery.conditions });
            }
        }
        else {
            // Simple column negation: whereNot('col', value) or whereNot('col', 'op', value)
            if (value === undefined) {
                // Two args: column, value -> use != operator
                return this.where(columnOrCallback, '!=', operatorOrValue);
            }
            else {
                // Three args: column, operator, value -> negate the operator
                const negatedOp = this.negateOperator(operatorOrValue);
                return this.where(columnOrCallback, negatedOp, value);
            }
        }
        return this;
    }
    negateOperator(op) {
        const negations = {
            '=': '!=', '!=': '=', '<>': '=',
            '<': '>=', '<=': '>', '>': '<=', '>=': '<',
            'LIKE': 'NOT LIKE', 'NOT LIKE': 'LIKE',
            'IN': 'NOT IN', 'NOT IN': 'IN'
        };
        return negations[op.toUpperCase()] || op;
    }
    // whereAny - match any of the given columns
    whereAny(columns, operator, value) {
        const conditions = columns.map(col => `${col} ${operator} ?`).join(' OR ');
        const bindings = columns.map(() => value);
        this.conditions.push({ operator: 'AND', type: 'raw', sql: `(${conditions})`, bindings });
        return this;
    }
    // whereAll - match all of the given columns
    whereAll(columns, operator, value) {
        const conditions = columns.map(col => `${col} ${operator} ?`).join(' AND ');
        const bindings = columns.map(() => value);
        this.conditions.push({ operator: 'AND', type: 'raw', sql: `(${conditions})`, bindings });
        return this;
    }
    // whereLike - case-sensitive LIKE
    whereLike(column, value) {
        return this.where(column, 'LIKE', value);
    }
    // whereNotLike
    whereNotLike(column, value) {
        return this.where(column, 'NOT LIKE', value);
    }
    // whereIntegerInRaw - for large arrays, uses raw SQL without bindings
    whereIntegerInRaw(column, values) {
        if (values.length === 0) {
            this.conditions.push({ operator: 'AND', type: 'raw', sql: '0 = 1', bindings: [] });
        }
        else {
            const list = values.map(v => parseInt(String(v), 10)).join(', ');
            this.conditions.push({ operator: 'AND', type: 'raw', sql: `${column} IN (${list})`, bindings: [] });
        }
        return this;
    }
    whereIntegerNotInRaw(column, values) {
        if (values.length === 0) {
            return this; // No constraint needed
        }
        const list = values.map(v => parseInt(String(v), 10)).join(', ');
        this.conditions.push({ operator: 'AND', type: 'raw', sql: `${column} NOT IN (${list})`, bindings: [] });
        return this;
    }
    // reorder - clear existing orders and optionally set new one
    reorder(column, direction = 'asc') {
        this.orderByClauses = [];
        if (column) {
            this.orderBy(column, direction);
        }
        return this;
    }
    selectRaw(sql, bindings) {
        this.ensureReadOnlySnippet(sql, 'selectRaw');
        this.selectColumns.push(sql);
        if (bindings && bindings.length)
            this.selectBindings.push(...bindings);
        return this;
    }
    whereRaw(sql, bindings) {
        this.ensureReadOnlySnippet(sql, 'whereRaw');
        this.conditions.push({ operator: 'AND', type: 'raw', sql, bindings: bindings || [] });
        return this;
    }
    orWhereRaw(sql, bindings) {
        this.ensureReadOnlySnippet(sql, 'orWhereRaw');
        this.conditions.push({ operator: 'OR', type: 'raw', sql, bindings: bindings || [] });
        return this;
    }
    when(condition, callback, defaultCallback) {
        if (condition) {
            callback(this);
        }
        else if (defaultCallback) {
            defaultCallback(this);
        }
        return this;
    }
    unless(condition, callback, defaultCallback) {
        if (!condition) {
            callback(this);
        }
        else if (defaultCallback) {
            defaultCallback(this);
        }
        return this;
    }
    whereHas(relation, callback, operator, count) {
        // If operator and count are provided, use HAVING COUNT comparison
        if (operator !== undefined && count !== undefined) {
            const countSubquery = this.buildCountSubquery(relation, callback);
            this.whereRaw(`(${countSubquery.sql}) ${operator} ?`, [...countSubquery.params, count]);
        }
        else {
            // Standard EXISTS check
            const exists = this.buildHasSubquery(relation, callback);
            this.whereRaw(`EXISTS (${exists.sql})`, exists.params);
        }
        return this;
    }
    orWhereHas(relation, callback, operator, count) {
        if (operator !== undefined && count !== undefined) {
            const countSubquery = this.buildCountSubquery(relation, callback);
            this.orWhereRaw(`(${countSubquery.sql}) ${operator} ?`, [...countSubquery.params, count]);
        }
        else {
            const exists = this.buildHasSubquery(relation, callback);
            this.orWhereRaw(`EXISTS (${exists.sql})`, exists.params);
        }
        return this;
    }
    doesntHave(relation, callback) {
        const exists = this.buildHasSubquery(relation, callback);
        this.whereRaw(`NOT EXISTS (${exists.sql})`, exists.params);
        return this;
    }
    whereDoesntHave(relation, callback) {
        return this.doesntHave(relation, callback);
    }
    orDoesntHave(relation, callback) {
        const exists = this.buildHasSubquery(relation, callback);
        this.orWhereRaw(`NOT EXISTS (${exists.sql})`, exists.params);
        return this;
    }
    orWhereDoesntHave(relation, callback) {
        return this.orDoesntHave(relation, callback);
    }
    whereBelongsTo(model, relation) {
        if (Array.isArray(model)) {
            const ids = model.map(m => m.id).filter(id => id !== null && id !== undefined);
            if (ids.length === 0) {
                this.whereRaw('0=1'); // No matches
                return this;
            }
            return this.whereIn(this.getBelongsToForeignKey(relation), ids);
        }
        else {
            return this.where(this.getBelongsToForeignKey(relation), model.id);
        }
    }
    getBelongsToForeignKey(relation) {
        if (relation) {
            const cfg = Eloquent.getRelationConfig(this.model, relation);
            if (cfg && cfg.type === 'belongsTo') {
                return cfg.foreignKey;
            }
            throw new Error(`Relation '${relation}' is not a belongsTo relationship`);
        }
        else {
            // Infer from model type - this is a simplified version
            // In a full implementation, you'd need to map model types to foreign keys
            throw new Error('Relation name must be provided for whereBelongsTo when not inferring from model type');
        }
    }
    whereRelation(relation, callback) {
        return this.whereHas(relation, callback);
    }
    orWhereRelation(relation, callback) {
        return this.orWhereHas(relation, callback);
    }
    whereHasMorph(relation, types, callback) {
        const typeArray = Array.isArray(types) ? types : [types];
        const subquery = this.buildHasMorphSubquery(relation, typeArray, callback);
        this.whereRaw(`(${subquery.sql})`, subquery.params);
        return this;
    }
    orWhereHasMorph(relation, types, callback) {
        const typeArray = Array.isArray(types) ? types : [types];
        const subquery = this.buildHasMorphSubquery(relation, typeArray, callback);
        this.orWhereRaw(`(${subquery.sql})`, subquery.params);
        return this;
    }
    whereMorphedTo(relation, model) {
        const cfg = Eloquent.getRelationConfig(this.model, relation);
        if (!cfg || cfg.type !== 'morphTo') {
            throw new Error(`Relation '${relation}' is not a morphTo relationship`);
        }
        const typeColumn = cfg.typeColumn || `${cfg.morphName}_type`;
        const idColumn = cfg.idColumn || `${cfg.morphName}_id`;
        const typeValue = Eloquent.getMorphTypeForModel(model.constructor);
        return this.where(typeColumn, typeValue).where(idColumn, model.id);
    }
    has(relation, operator = '>=', count = 1) {
        // If using default operator and count of 1, use EXISTS for efficiency
        if (operator === '>=' && count === 1) {
            return this.whereHas(relation);
        }
        // Otherwise use count comparison
        return this.whereHas(relation, undefined, operator, count);
    }
    orHas(relation, operator = '>=', count = 1) {
        if (operator === '>=' && count === 1) {
            return this.orWhereHas(relation);
        }
        return this.orWhereHas(relation, undefined, operator, count);
    }
    withCount(relations) {
        const list = [];
        if (typeof relations === 'string') {
            list.push({ name: relations });
        }
        else if (Array.isArray(relations)) {
            for (const name of relations)
                list.push({ name });
        }
        else if (relations && typeof relations === 'object') {
            for (const [name, cb] of Object.entries(relations))
                list.push({ name, cb });
        }
        for (const item of list) {
            const count = this.buildCountSubquery(item.name, item.cb);
            const alias = `${item.name.replace(/\./g, '_')}_count`;
            // Push a placeholder for params to keep them bound correctly
            this.selectRaw(`(${count.sql}) as ${alias}`, count.params);
        }
        return this;
    }
    buildCountSubquery(relation, callback) {
        const exists = this.buildHasSubquery(relation, callback, true);
        // convert SELECT 1 ... to SELECT COUNT(*) ... by replacing prefix
        const sql = exists.sql.replace(/^SELECT\s+1\s+/i, 'SELECT COUNT(*) ');
        return { sql, params: exists.params };
    }
    buildHasSubquery(relationName, callback, isCount = false) {
        const cfg = Eloquent.getRelationConfig(this.model, relationName);
        if (!cfg) {
            throw new Error(`Relationship '${relationName}' does not exist on model ${this.model.name}`);
        }
        const parentTable = this.tableName || this.model.table || this.model.name.toLowerCase() + 's';
        const RelatedModel = typeof cfg.model === 'string' ? Eloquent.getModelForMorphType(cfg.model) : cfg.model;
        const relatedTable = RelatedModel.table || RelatedModel.name.toLowerCase() + 's';
        const relQB = RelatedModel.query();
        if (callback)
            callback(relQB);
        // apply soft delete scope to related
        const relSoft = RelatedModel.softDeletes;
        const relConditions = relQB.conditions ? JSON.parse(JSON.stringify(relQB.conditions)) : [];
        if (relSoft) {
            const mode = relQB.trashedMode;
            if (mode === 'default')
                relConditions.push({ operator: 'AND', type: 'null', column: `${relatedTable}.deleted_at` });
            else if (mode === 'only')
                relConditions.push({ operator: 'AND', type: 'not_null', column: `${relatedTable}.deleted_at` });
        }
        const where = this.buildWhereClause(relConditions);
        const parts = [];
        const params = [];
        // relationship linkage
        if (cfg.type === 'hasMany' || cfg.type === 'hasOne') {
            const foreignKey = cfg.foreignKey;
            const localKey = cfg.localKey || 'id';
            parts.push(`${relatedTable}.${foreignKey} = ${parentTable}.${localKey}`);
        }
        else if (cfg.type === 'belongsTo') {
            const foreignKey = cfg.foreignKey;
            const ownerKey = cfg.ownerKey || 'id';
            parts.push(`${relatedTable}.${ownerKey} = ${parentTable}.${foreignKey}`);
        }
        else if (cfg.type === 'morphMany' || cfg.type === 'morphOne') {
            const name = cfg.morphName;
            const typeColumn = cfg.typeColumn || `${name}_type`;
            const idColumn = cfg.idColumn || `${name}_id`;
            const localKey = cfg.localKey || 'id';
            const morphTypes = Eloquent.getPossibleMorphTypesForModel(this.model);
            parts.push(`${relatedTable}.${idColumn} = ${parentTable}.${localKey}`);
            parts.push(`${relatedTable}.${typeColumn} IN (${morphTypes.map(() => '?').join(', ')})`);
            params.push(...morphTypes);
        }
        else if (cfg.type === 'belongsToMany') {
            const pivotTable = cfg.table || [this.model.name.toLowerCase(), RelatedModel.name.toLowerCase()].sort().join('_');
            const fpk = cfg.foreignPivotKey || `${this.model.name.toLowerCase()}_id`;
            const rpk = cfg.relatedPivotKey || `${RelatedModel.name.toLowerCase()}_id`;
            const parentKey = cfg.parentKey || 'id';
            const relatedKey = cfg.relatedKey || 'id';
            // Build join in FROM clause
            const join = `FROM ${relatedTable} JOIN ${pivotTable} ON ${relatedTable}.${relatedKey} = ${pivotTable}.${rpk}`;
            const link = `${pivotTable}.${fpk} = ${parentTable}.${parentKey}`;
            const whereSql = where.sql ? ` AND ${where.sql}` : '';
            const sql = `SELECT 1 ${join} WHERE ${link}${whereSql}`;
            return { sql, params: [...where.params] };
        }
        else {
            // morphTo and others not supported yet here
            return { sql: 'SELECT 1 WHERE 0=1', params: [] };
        }
        const whereSql = where.sql ? ` AND ${where.sql}` : '';
        const sql = `SELECT 1 FROM ${relatedTable} WHERE ${parts.join(' AND ')}${whereSql}`;
        params.push(...where.params);
        return { sql, params };
    }
    buildHasMorphSubquery(relationName, morphTypes, callback) {
        const cfg = Eloquent.getRelationConfig(this.model, relationName);
        if (!cfg || cfg.type !== 'morphTo') {
            throw new Error(`Relation '${relationName}' must be a morphTo relationship`);
        }
        const typeColumn = cfg.typeColumn || `${cfg.morphName}_type`;
        const idColumn = cfg.idColumn || `${cfg.morphName}_id`;
        const parentTable = this.tableName || this.model.table || this.model.name.toLowerCase() + 's';
        // Resolve morph types to strings
        const typeStrings = morphTypes.map(t => typeof t === 'string' ? t : Eloquent.getMorphTypeForModel(t));
        const allParts = [];
        const allParams = [];
        for (const morphType of typeStrings) {
            // Get the related model for this morph type
            const RelatedModel = Eloquent.getModelForMorphType(morphType);
            if (!RelatedModel) {
                throw new Error(`Cannot resolve model for morph type '${morphType}'`);
            }
            const relatedTable = RelatedModel.table || RelatedModel.name.toLowerCase() + 's';
            // Build subquery for this type
            const relQB = RelatedModel.query();
            if (callback)
                callback(relQB);
            // Get conditions from callback
            const relConditions = relQB.conditions
                ? JSON.parse(JSON.stringify(relQB.conditions))
                : [];
            // Apply soft delete scope
            const relSoft = RelatedModel.softDeletes;
            if (relSoft) {
                const mode = relQB.trashedMode;
                if (mode === 'default') {
                    relConditions.push({ operator: 'AND', type: 'null', column: `${relatedTable}.deleted_at` });
                }
                else if (mode === 'only') {
                    relConditions.push({ operator: 'AND', type: 'not_null', column: `${relatedTable}.deleted_at` });
                }
            }
            const where = this.buildWhereClause(relConditions);
            const whereSql = where.sql ? ` AND ${where.sql}` : '';
            // Build EXISTS subquery for this morph type
            const sql = `(${parentTable}.${typeColumn} = ? AND EXISTS (
                SELECT 1 FROM ${relatedTable}
                WHERE ${relatedTable}.id = ${parentTable}.${idColumn}${whereSql}
            ))`;
            allParts.push(sql);
            allParams.push(morphType, ...where.params);
        }
        return {
            sql: allParts.join(' OR '),
            params: allParams
        };
    }
    with(relations, callback) {
        if (!this.withRelations)
            this.withRelations = [];
        if (!this.withCallbacks)
            this.withCallbacks = {};
        if (!this.withColumns)
            this.withColumns = {};
        if (typeof relations === 'string') {
            const parsed = this.parseRelationWithColumns(relations);
            this.withRelations.push(parsed.relation);
            if (parsed.columns)
                this.withColumns[parsed.relation] = parsed.columns;
            if (callback)
                this.withCallbacks[parsed.relation] = callback;
        }
        else if (Array.isArray(relations)) {
            for (const name of relations) {
                const parsed = this.parseRelationWithColumns(name);
                this.withRelations.push(parsed.relation);
                if (parsed.columns)
                    this.withColumns[parsed.relation] = parsed.columns;
            }
        }
        else if (relations && typeof relations === 'object') {
            for (const [name, value] of Object.entries(relations)) {
                this.withRelations.push(name);
                if (Array.isArray(value)) {
                    this.withColumns[name] = value;
                }
                else if (typeof value === 'function') {
                    this.withCallbacks[name] = value;
                }
            }
        }
        return this;
    }
    parseRelationWithColumns(relation) {
        const colonIndex = relation.indexOf(':');
        if (colonIndex === -1) {
            return { relation };
        }
        const relName = relation.substring(0, colonIndex);
        const columnsStr = relation.substring(colonIndex + 1);
        const columns = columnsStr.split(',').map(col => col.trim()).filter(col => col.length > 0);
        return { relation: relName, columns };
    }
    withWhereHas(relation, callback) {
        // withWhereHas both constrains the query and eager loads the relation
        this.whereHas(relation, callback);
        return this.with(relation, callback);
    }
    without(relations) {
        if (!this.withRelations)
            return this;
        const relationsToRemove = Array.isArray(relations) ? relations : [relations];
        this.withRelations = this.withRelations.filter(rel => !relationsToRemove.includes(rel));
        // Also remove from callbacks and columns
        for (const rel of relationsToRemove) {
            if (this.withCallbacks)
                delete this.withCallbacks[rel];
            if (this.withColumns)
                delete this.withColumns[rel];
        }
        return this;
    }
    withOnly(relations) {
        // Clear existing relations and set only the specified ones
        this.withRelations = [];
        this.withCallbacks = {};
        this.withColumns = {};
        return this.with(relations);
    }
    withTrashed() {
        this.trashedMode = 'with';
        return this;
    }
    onlyTrashed() {
        this.trashedMode = 'only';
        return this;
    }
    withoutTrashed() {
        this.trashedMode = 'default';
        return this;
    }
    latestOfMany(column = 'created_at') {
        return this.ofMany(column, 'max');
    }
    oldestOfMany(column = 'created_at') {
        return this.ofMany(column, 'min');
    }
    ofMany(column, aggregate) {
        const table = this.tableName || this.model.table || this.model.name.toLowerCase() + 's';
        // Build the subquery to find the aggregate value
        const subQuery = this.clone();
        subQuery.selectColumns = [`${aggregate.toUpperCase()}(${column}) as aggregate_value`];
        subQuery.limitValue = undefined;
        subQuery.offsetValue = undefined;
        subQuery.orderByClauses = [];
        const subQuerySql = subQuery.buildSelectSql();
        // Add condition to match the aggregate value
        this.whereRaw(`${column} = (${subQuerySql.sql})`, subQuerySql.params);
        // Add ordering and limit to ensure we get only one record
        this.orderBy(column, aggregate === 'max' ? 'desc' : 'asc').limit(1);
        return this;
    }
    clone() {
        const cloned = new QueryBuilder(this.model);
        cloned.tableName = this.tableName;
        cloned.conditions = this.conditions ? JSON.parse(JSON.stringify(this.conditions)) : [];
        cloned.selectColumns = this.selectColumns ? [...this.selectColumns] : ['*'];
        cloned.joins = this.joins ? [...this.joins] : [];
        cloned.unions = this.unions ? [...this.unions] : [];
        cloned.limitValue = this.limitValue;
        cloned.offsetValue = this.offsetValue;
        cloned.orderByClauses = this.orderByClauses ? [...this.orderByClauses] : [];
        cloned.groupByColumns = this.groupByColumns ? [...this.groupByColumns] : [];
        cloned.havingConditions = this.havingConditions ? JSON.parse(JSON.stringify(this.havingConditions)) : [];
        cloned.withRelations = this.withRelations ? [...this.withRelations] : [];
        cloned.withCallbacks = this.withCallbacks ? { ...this.withCallbacks } : undefined;
        cloned.withColumns = this.withColumns ? { ...this.withColumns } : undefined;
        cloned.trashedMode = this.trashedMode;
        cloned.selectBindings = this.selectBindings ? [...this.selectBindings] : [];
        cloned.pivotConfig = this.pivotConfig
            ? { table: this.pivotConfig.table, alias: this.pivotConfig.alias, columns: new Set(this.pivotConfig.columns) }
            : undefined;
        return cloned;
    }
    chunkArray(arr, size) {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    }
    async getInBatches(ids, fetcher) {
        if (!ids || ids.length === 0)
            return [];
        const unique = Array.from(new Set(ids));
        const chunks = this.chunkArray(unique, QueryBuilder.IN_CHUNK_SIZE);
        const all = [];
        for (const c of chunks) {
            const rows = await fetcher(c);
            if (rows && rows.length)
                all.push(...rows);
        }
        return all;
    }
    // BelongsToMany helpers
    setPivotSource(table, alias = 'pivot') {
        if (!this.pivotConfig)
            this.pivotConfig = { table, alias, columns: new Set() };
        return this;
    }
    as(alias) {
        if (!this.pivotConfig)
            return this;
        this.pivotConfig.alias = alias;
        return this;
    }
    withPivot(...columns) {
        if (!this.pivotConfig)
            return this;
        for (const col of columns) {
            if (!col)
                continue;
            this.pivotConfig.columns.add(col);
            const alias = `${this.pivotConfig.alias}__${col}`;
            this.addSelect(`${this.pivotConfig.table}.${col} AS ${alias}`);
        }
        return this;
    }
    scope(name, ...args) {
        const model = this.model;
        const scopeMethodName = `scope${name.charAt(0).toUpperCase() + name.slice(1)}`;
        const scopeMethod = model && model[scopeMethodName];
        if (typeof scopeMethod === 'function') {
            return scopeMethod.call(model, this, ...args);
        }
        return this;
    }
    applyCast(value, castType) {
        if (value === null || value === undefined)
            return value;
        switch (castType) {
            case 'integer':
            case 'int':
                return parseInt(value, 10);
            case 'float':
            case 'double':
            case 'decimal':
                return parseFloat(value);
            case 'boolean':
            case 'bool':
                return Boolean(value);
            case 'string':
                return String(value);
            case 'datetime':
                return new Date(value);
            case 'array':
            case 'json':
                return typeof value === 'string' ? JSON.parse(value) : value;
            default:
                return value;
        }
    }
    async loadRelations(instances, relations, model, prefix) {
        if (!relations || relations.length === 0)
            return;
        const currentModel = model || this.model;
        // Debug logging
        this.debugLog('Loading relations', { instanceCount: instances.length, relations, model: currentModel.name });
        // Group relations by their top-level key to avoid loading the same relation multiple times
        // e.g., ['posts.tags', 'posts.comments'] becomes { posts: ['tags', 'comments'] }
        const groupedRelations = new Map();
        for (const relation of relations) {
            const parts = relation.split('.');
            const relationKey = parts[0];
            if (!groupedRelations.has(relationKey)) {
                groupedRelations.set(relationKey, []);
            }
            if (parts.length > 1) {
                groupedRelations.get(relationKey).push(parts.slice(1).join('.'));
            }
        }
        // Process each unique top-level relation once
        for (const [relationKey, subRelations] of groupedRelations) {
            const fullPath = prefix ? `${prefix}.${relationKey}` : relationKey;
            const cfg = Eloquent.getRelationConfig(currentModel, relationKey);
            // Only load if not already loaded on instances (check if the data is stored as own property)
            const needsLoad = instances.some(inst => !Object.prototype.hasOwnProperty.call(inst, relationKey));
            if (needsLoad) {
                await this.loadSingleRelation(instances, relationKey, currentModel, fullPath);
            }
            // If there are nested relations to load
            if (subRelations.length > 0) {
                const relValues = instances
                    .map(inst => inst[relationKey])
                    .filter((v) => v !== null && v !== undefined);
                if (!cfg)
                    continue;
                if (cfg.type === 'morphTo') {
                    // Group by constructor to recurse per concrete model
                    const groups = new Map();
                    for (const val of relValues) {
                        if (Array.isArray(val)) {
                            for (const item of val) {
                                const ctor = item && item.constructor;
                                if (!ctor)
                                    continue;
                                let arr = groups.get(ctor);
                                if (!arr) {
                                    arr = [];
                                    groups.set(ctor, arr);
                                }
                                arr.push(item);
                            }
                        }
                        else {
                            const ctor = val && val.constructor;
                            if (!ctor)
                                continue;
                            let arr = groups.get(ctor);
                            if (!arr) {
                                arr = [];
                                groups.set(ctor, arr);
                            }
                            arr.push(val);
                        }
                    }
                    for (const [ctor, list] of groups) {
                        if (!ctor)
                            continue;
                        await this.loadRelations(list, subRelations, ctor, fullPath);
                    }
                }
                else {
                    // Non-polymorphic: flatten arrays if morphMany/hasMany
                    let list = [];
                    for (const v of relValues) {
                        if (Array.isArray(v))
                            list.push(...v);
                        else
                            list.push(v);
                    }
                    // Resolve model if it's a string
                    const nestedModel = typeof cfg.model === 'string'
                        ? Eloquent.getModelForMorphType(cfg.model)
                        : cfg.model;
                    await this.loadRelations(list, subRelations, nestedModel, fullPath);
                }
            }
        }
    }
    async loadSingleRelation(instances, relationName, model, fullPath) {
        const config = Eloquent.getRelationConfig(model, relationName);
        if (!config) {
            throw new Error(`Relationship '${relationName}' does not exist on model ${model.name}`);
        }
        const type = config.type;
        if (type === 'belongsTo') {
            const RelatedModel = typeof config.model === 'string'
                ? Eloquent.getModelForMorphType(config.model)
                : config.model;
            if (!RelatedModel) {
                throw new Error(`Model '${config.model}' not found in morph map`);
            }
            const foreignKey = config.foreignKey;
            const ownerKey = config.ownerKey || 'id';
            const foreignKeys = instances.map(inst => inst[foreignKey]).filter(id => id !== null && id !== undefined);
            if (foreignKeys.length === 0)
                return;
            const cb = this.withCallbacks && this.withCallbacks[fullPath];
            const relatedInstances = await this.getInBatches(foreignKeys, async (chunk) => {
                const qb = RelatedModel.query().whereIn(ownerKey, chunk);
                if (cb)
                    cb(qb);
                return qb.get();
            });
            // Share a collection among related instances for nested propagation
            const relatedCollection = new Collection();
            for (const rel of relatedInstances)
                relatedCollection.push(rel);
            for (const rel of relatedInstances) {
                try {
                    Object.defineProperty(rel, '__collection', { value: relatedCollection, enumerable: false, configurable: true, writable: true });
                }
                catch { }
            }
            const map = new Map(relatedInstances.map((rel) => [rel[ownerKey], rel]));
            for (const inst of instances) {
                const target = map.get(inst[foreignKey]) || null;
                inst[relationName] = target;
                try {
                    const holder = inst.__relations || {};
                    if (!inst.__relations) {
                        Object.defineProperty(inst, '__relations', { value: holder, enumerable: false, configurable: true, writable: true });
                    }
                    holder[relationName] = true;
                }
                catch { /* no-op */ }
            }
        }
        else if (type === 'hasMany') {
            const RelatedModel = typeof config.model === 'string'
                ? Eloquent.getModelForMorphType(config.model)
                : config.model;
            if (!RelatedModel) {
                throw new Error(`Model '${config.model}' not found in morph map`);
            }
            const foreignKey = config.foreignKey;
            const localKey = config.localKey || 'id';
            const localKeys = instances.map(inst => inst[localKey]).filter(id => id !== null && id !== undefined);
            if (localKeys.length === 0)
                return;
            const cb = this.withCallbacks && this.withCallbacks[fullPath];
            const relatedInstances = await this.getInBatches(localKeys, async (chunk) => {
                const qb = RelatedModel.query().whereIn(foreignKey, chunk);
                if (cb)
                    cb(qb);
                return qb.get();
            });
            const relatedCollection = new Collection();
            for (const rel of relatedInstances)
                relatedCollection.push(rel);
            for (const rel of relatedInstances) {
                try {
                    Object.defineProperty(rel, '__collection', { value: relatedCollection, enumerable: false, configurable: true, writable: true });
                }
                catch { }
            }
            const map = new Map();
            for (const rel of relatedInstances) {
                const key = rel[foreignKey];
                if (!map.has(key))
                    map.set(key, []);
                map.get(key).push(rel);
            }
            for (const inst of instances) {
                inst[relationName] = map.get(inst[localKey]) || [];
                try {
                    const holder = inst.__relations || {};
                    if (!inst.__relations) {
                        Object.defineProperty(inst, '__relations', { value: holder, enumerable: false, configurable: true, writable: true });
                    }
                    holder[relationName] = true;
                }
                catch { /* no-op */ }
            }
        }
        else if (type === 'hasOne') {
            const RelatedModel = typeof config.model === 'string'
                ? Eloquent.getModelForMorphType(config.model)
                : config.model;
            if (!RelatedModel) {
                throw new Error(`Model '${config.model}' not found in morph map`);
            }
            const foreignKey = config.foreignKey;
            const localKey = config.localKey || 'id';
            const localKeys = instances.map(inst => inst[localKey]).filter(id => id !== null && id !== undefined);
            if (localKeys.length === 0)
                return;
            const cb = this.withCallbacks && this.withCallbacks[fullPath];
            const relatedInstances = await this.getInBatches(localKeys, async (chunk) => {
                const qb = RelatedModel.query().whereIn(foreignKey, chunk);
                if (cb)
                    cb(qb);
                return qb.get();
            });
            const relatedCollection = new Collection();
            for (const rel of relatedInstances)
                relatedCollection.push(rel);
            for (const rel of relatedInstances) {
                try {
                    Object.defineProperty(rel, '__collection', { value: relatedCollection, enumerable: false, configurable: true, writable: true });
                }
                catch { }
            }
            const map = new Map();
            for (const rel of relatedInstances) {
                const key = rel[foreignKey];
                map.set(key, rel);
            }
            for (const inst of instances) {
                inst[relationName] = map.get(inst[localKey]) || null;
                try {
                    const holder = inst.__relations || {};
                    if (!inst.__relations) {
                        Object.defineProperty(inst, '__relations', { value: holder, enumerable: false, configurable: true, writable: true });
                    }
                    holder[relationName] = true;
                }
                catch { /* no-op */ }
            }
        }
        else if (type === 'morphOne') {
            const RelatedModel = typeof config.model === 'string' ? Eloquent.getModelForMorphType(config.model) : config.model;
            const name = config.morphName;
            const typeColumn = config.typeColumn || `${name}_type`;
            const idColumn = config.idColumn || `${name}_id`;
            const localKey = config.localKey || 'id';
            const localKeys = instances.map(inst => inst[localKey]).filter((id) => id !== null && id !== undefined);
            if (localKeys.length === 0)
                return;
            const morphTypes = Eloquent.getPossibleMorphTypesForModel(model);
            const cb = this.withCallbacks && this.withCallbacks[fullPath];
            const relatedInstances = await this.getInBatches(localKeys, async (chunk) => {
                const qb = RelatedModel.query().whereIn(typeColumn, morphTypes).whereIn(idColumn, chunk);
                if (cb)
                    cb(qb);
                return qb.get();
            });
            const relatedCollection = new Collection();
            for (const rel of relatedInstances)
                relatedCollection.push(rel);
            for (const rel of relatedInstances) {
                try {
                    Object.defineProperty(rel, '__collection', { value: relatedCollection, enumerable: false, configurable: true, writable: true });
                }
                catch { }
            }
            const map = new Map();
            for (const rel of relatedInstances) {
                const key = rel[idColumn];
                map.set(key, rel);
            }
            for (const inst of instances) {
                inst[relationName] = map.get(inst[localKey]) || null;
                try {
                    const holder = inst.__relations || {};
                    if (!inst.__relations) {
                        Object.defineProperty(inst, '__relations', { value: holder, enumerable: false, configurable: true, writable: true });
                    }
                    holder[relationName] = true;
                }
                catch { /* no-op */ }
            }
        }
        else if (type === 'morphMany') {
            const RelatedModel = typeof config.model === 'string' ? Eloquent.getModelForMorphType(config.model) : config.model;
            const name = config.morphName;
            const typeColumn = config.typeColumn || `${name}_type`;
            const idColumn = config.idColumn || `${name}_id`;
            const localKey = config.localKey || 'id';
            const localKeys = instances.map(inst => inst[localKey]).filter((id) => id !== null && id !== undefined);
            if (localKeys.length === 0)
                return;
            const morphTypes = Eloquent.getPossibleMorphTypesForModel(model);
            const cb = this.withCallbacks && this.withCallbacks[fullPath];
            const relatedInstances = await this.getInBatches(localKeys, async (chunk) => {
                const qb = RelatedModel.query().whereIn(typeColumn, morphTypes).whereIn(idColumn, chunk);
                if (cb)
                    cb(qb);
                return qb.get();
            });
            const relatedCollection = new Collection();
            for (const rel of relatedInstances)
                relatedCollection.push(rel);
            for (const rel of relatedInstances) {
                try {
                    Object.defineProperty(rel, '__collection', { value: relatedCollection, enumerable: false, configurable: true, writable: true });
                }
                catch { }
            }
            const map = new Map();
            for (const rel of relatedInstances) {
                const key = rel[idColumn];
                if (!map.has(key))
                    map.set(key, []);
                map.get(key).push(rel);
            }
            for (const inst of instances) {
                inst[relationName] = map.get(inst[localKey]) || [];
                try {
                    const holder = inst.__relations || {};
                    if (!inst.__relations) {
                        Object.defineProperty(inst, '__relations', { value: holder, enumerable: false, configurable: true, writable: true });
                    }
                    holder[relationName] = true;
                }
                catch { /* no-op */ }
            }
        }
        else if (type === 'morphOneOfMany') {
            // morphOneOfMany: Get one related record per parent based on aggregate (max/min) of a column
            const RelatedModel = typeof config.model === 'string' ? Eloquent.getModelForMorphType(config.model) : config.model;
            const name = config.morphName;
            const typeColumn = config.typeColumn || `${name}_type`;
            const idColumn = config.idColumn || `${name}_id`;
            const localKey = config.localKey || 'id';
            const column = config.column || 'created_at';
            const aggregate = config.aggregate || 'max'; // 'max' for latest, 'min' for oldest
            const localKeys = instances.map(inst => inst[localKey]).filter((id) => id !== null && id !== undefined);
            if (localKeys.length === 0)
                return;
            const morphTypes = Eloquent.getPossibleMorphTypesForModel(model);
            const relatedTable = RelatedModel.table || RelatedModel.name.toLowerCase() + 's';
            const cb = this.withCallbacks && this.withCallbacks[fullPath];
            // Use a subquery to find the record with max/min of the column for each parent
            const relatedInstances = await this.getInBatches(localKeys, async (chunk) => {
                const aggFn = aggregate === 'max' ? 'MAX' : 'MIN';
                const qb = RelatedModel.query()
                    .whereIn(typeColumn, morphTypes)
                    .whereIn(idColumn, chunk)
                    .whereRaw(`${relatedTable}.${column} = (
                        SELECT ${aggFn}(sub.${column}) FROM ${relatedTable} sub
                        WHERE sub.${typeColumn} = ${relatedTable}.${typeColumn}
                        AND sub.${idColumn} = ${relatedTable}.${idColumn}
                    )`);
                if (cb)
                    cb(qb);
                return qb.get();
            });
            const relatedCollection = new Collection();
            for (const rel of relatedInstances)
                relatedCollection.push(rel);
            for (const rel of relatedInstances) {
                try {
                    Object.defineProperty(rel, '__collection', { value: relatedCollection, enumerable: false, configurable: true, writable: true });
                }
                catch { }
            }
            const map = new Map();
            for (const rel of relatedInstances) {
                const key = rel[idColumn];
                // Only keep the first (should be only one per parent anyway)
                if (!map.has(key)) {
                    map.set(key, rel);
                }
            }
            for (const inst of instances) {
                inst[relationName] = map.get(inst[localKey]) || null;
                try {
                    const holder = inst.__relations || {};
                    if (!inst.__relations) {
                        Object.defineProperty(inst, '__relations', { value: holder, enumerable: false, configurable: true, writable: true });
                    }
                    holder[relationName] = true;
                }
                catch { /* no-op */ }
            }
        }
        else if (type === 'morphTo') {
            const name = config.morphName;
            const typeColumn = config.typeColumn || `${name}_type`;
            const idColumn = config.idColumn || `${name}_id`;
            const byType = new Map();
            for (const inst of instances) {
                const t = inst[typeColumn];
                const id = inst[idColumn];
                if (t === null || t === undefined || id === null || id === undefined)
                    continue;
                let arr = byType.get(t);
                if (!arr) {
                    arr = [];
                    byType.set(t, arr);
                }
                arr.push(inst);
            }
            for (const [t, list] of byType) {
                const ModelCtor = Eloquent.getModelForMorphType(t);
                if (!ModelCtor) {
                    for (const inst of list) {
                        inst[relationName] = null;
                    }
                    continue;
                }
                const ids = list.map((inst) => inst[idColumn]);
                const cb = this.withCallbacks && this.withCallbacks[fullPath];
                const relatedInstances = await this.getInBatches(ids, async (chunk) => {
                    const qb = ModelCtor.query().whereIn('id', chunk);
                    if (cb)
                        cb(qb);
                    return qb.get();
                });
                const relatedCollection = new Collection();
                for (const rel of relatedInstances)
                    relatedCollection.push(rel);
                for (const rel of relatedInstances) {
                    try {
                        Object.defineProperty(rel, '__collection', { value: relatedCollection, enumerable: false, configurable: true, writable: true });
                    }
                    catch { }
                }
                const map = new Map(relatedInstances.map((rel) => [rel.id, rel]));
                for (const inst of list) {
                    inst[relationName] = map.get(inst[idColumn]) || null;
                    try {
                        const holder = inst.__relations || {};
                        if (!inst.__relations) {
                            Object.defineProperty(inst, '__relations', { value: holder, enumerable: false, configurable: true, writable: true });
                        }
                        holder[relationName] = true;
                    }
                    catch { /* no-op */ }
                }
            }
        }
        else if (type === 'hasManyThrough' || type === 'hasOneThrough') {
            // HasManyThrough / HasOneThrough
            const RelatedModel = typeof config.model === 'string'
                ? Eloquent.getModelForMorphType(config.model)
                : config.model;
            const ThroughModel = typeof config.through === 'string'
                ? Eloquent.getModelForMorphType(config.through)
                : config.through;
            if (!RelatedModel) {
                throw new Error(`Related model '${config.model}' not found in morph map`);
            }
            if (!ThroughModel) {
                throw new Error(`Through model '${config.through}' not found in morph map`);
            }
            const relatedTable = RelatedModel.table || RelatedModel.name.toLowerCase() + 's';
            const throughTable = ThroughModel.table || ThroughModel.name.toLowerCase() + 's';
            const firstKey = config.firstKey || `${model.name.toLowerCase()}_id`;
            const secondKey = config.secondKey || `${ThroughModel.name.toLowerCase()}_id`;
            const localKey = config.localKey || 'id';
            const secondLocalKey = config.secondLocalKey || 'id';
            const parentIds = instances.map(inst => inst[localKey]).filter((id) => id !== null && id !== undefined);
            if (parentIds.length === 0)
                return;
            const cb = this.withCallbacks && this.withCallbacks[fullPath];
            // Query: SELECT related.*, through.firstKey as __through_fk FROM related
            //        JOIN through ON related.secondKey = through.secondLocalKey
            //        WHERE through.firstKey IN (parentIds)
            const rows = await this.getInBatches(parentIds, async (chunk) => {
                const qb = RelatedModel.query()
                    .addSelect(`${relatedTable}.*`)
                    .addSelect(`${throughTable}.${firstKey} as __through_fk`)
                    .join(throughTable, `${relatedTable}.${secondKey}`, '=', `${throughTable}.${secondLocalKey}`)
                    .whereIn(`${throughTable}.${firstKey}`, chunk);
                if (cb)
                    cb(qb);
                return qb.get();
            });
            const relatedCollection = new Collection();
            for (const rel of rows)
                relatedCollection.push(rel);
            for (const rel of rows) {
                try {
                    Object.defineProperty(rel, '__collection', { value: relatedCollection, enumerable: false, configurable: true, writable: true });
                }
                catch { }
            }
            if (type === 'hasOneThrough') {
                // HasOneThrough - assign first match or null
                const map = new Map();
                for (const rel of rows) {
                    const owner = rel['__through_fk'];
                    if (owner === null || owner === undefined)
                        continue;
                    if (!map.has(owner)) {
                        delete rel['__through_fk'];
                        map.set(owner, rel);
                    }
                }
                for (const inst of instances) {
                    inst[relationName] = map.get(inst[localKey]) || null;
                    try {
                        const holder = inst.__relations || {};
                        if (!inst.__relations) {
                            Object.defineProperty(inst, '__relations', { value: holder, enumerable: false, configurable: true, writable: true });
                        }
                        holder[relationName] = true;
                    }
                    catch { /* no-op */ }
                }
            }
            else {
                // HasManyThrough - assign array
                const map = new Map();
                for (const rel of rows) {
                    const owner = rel['__through_fk'];
                    if (owner === null || owner === undefined)
                        continue;
                    let arr = map.get(owner);
                    if (!arr) {
                        arr = [];
                        map.set(owner, arr);
                    }
                    delete rel['__through_fk'];
                    arr.push(rel);
                }
                for (const inst of instances) {
                    inst[relationName] = map.get(inst[localKey]) || [];
                    try {
                        const holder = inst.__relations || {};
                        if (!inst.__relations) {
                            Object.defineProperty(inst, '__relations', { value: holder, enumerable: false, configurable: true, writable: true });
                        }
                        holder[relationName] = true;
                    }
                    catch { /* no-op */ }
                }
            }
        }
        else if (type === 'belongsToMany') {
            const RelatedModel = typeof config.model === 'string'
                ? Eloquent.getModelForMorphType(config.model)
                : config.model;
            if (!RelatedModel) {
                throw new Error(`Model '${config.model}' not found in morph map`);
            }
            const relatedTable = RelatedModel.table || RelatedModel.name.toLowerCase() + 's';
            const pivotTable = config.table || [model.name.toLowerCase(), RelatedModel.name.toLowerCase()].sort().join('_');
            const fpk = config.foreignPivotKey || `${model.name.toLowerCase()}_id`;
            const rpk = config.relatedPivotKey || `${RelatedModel.name.toLowerCase()}_id`;
            const parentKey = config.parentKey || 'id';
            const relatedKey = config.relatedKey || 'id';
            const parentIds = instances.map(inst => inst[parentKey]).filter((id) => id !== null && id !== undefined);
            if (parentIds.length === 0)
                return;
            const cb = this.withCallbacks && this.withCallbacks[fullPath];
            // Expose pivot columns if requested via child query builder
            const columns = this.pivotConfig?.columns ? Array.from(this.pivotConfig.columns) : [];
            const alias = this.pivotConfig?.alias || 'pivot';
            const rows = await this.getInBatches(parentIds, async (chunk) => {
                const qb = RelatedModel.query()
                    .addSelect(`${relatedTable}.*`)
                    .addSelect(`${pivotTable}.${fpk} as __pivot_fk`)
                    .join(pivotTable, `${relatedTable}.${relatedKey}`, '=', `${pivotTable}.${rpk}`)
                    .whereIn(`${pivotTable}.${fpk}`, chunk);
                if (columns.length > 0) {
                    qb.setPivotSource?.(pivotTable, alias);
                    for (const col of columns) {
                        qb.addSelect(`${pivotTable}.${col} AS ${alias}__${col}`);
                    }
                }
                if (cb)
                    cb(qb);
                return qb.get();
            });
            const relatedCollection = new Collection();
            for (const rel of rows)
                relatedCollection.push(rel);
            for (const rel of rows) {
                try {
                    Object.defineProperty(rel, '__collection', { value: relatedCollection, enumerable: false, configurable: true, writable: true });
                }
                catch { }
            }
            const map = new Map();
            for (const rel of rows) {
                const owner = rel['__pivot_fk'];
                if (owner === null || owner === undefined)
                    continue;
                let arr = map.get(owner);
                if (!arr) {
                    arr = [];
                    map.set(owner, arr);
                }
                // Extract pivot data if columns were requested
                if (columns.length > 0) {
                    const pivotObj = {};
                    for (const col of columns) {
                        const pivotKey = `${alias}__${col}`;
                        if (pivotKey in rel) {
                            pivotObj[col] = rel[pivotKey];
                        }
                    }
                    if (Object.keys(pivotObj).length > 0) {
                        rel[alias] = pivotObj;
                    }
                }
                delete rel['__pivot_fk'];
                arr.push(rel);
            }
            for (const inst of instances) {
                inst[relationName] = map.get(inst[parentKey]) || [];
                try {
                    const holder = inst.__relations || {};
                    if (!inst.__relations) {
                        Object.defineProperty(inst, '__relations', { value: holder, enumerable: false, configurable: true, writable: true });
                    }
                    holder[relationName] = true;
                }
                catch { /* no-op */ }
            }
        }
    }
    async chunk(size, callback) {
        let page = 0;
        while (true) {
            const results = await this.clone().offset(page * size).limit(size).get();
            if (results.length === 0)
                break;
            await callback(results);
            page++;
        }
    }
    buildWhereClause(conditions) {
        let sql = '';
        const params = [];
        for (let i = 0; i < conditions.length; i++) {
            const cond = conditions[i];
            if (i > 0)
                sql += ` ${cond.operator} `;
            if ('group' in cond) {
                const sub = this.buildWhereClause(cond.group);
                if (sub.sql) {
                    sql += `(${sub.sql})`;
                    params.push(...sub.params);
                }
                else {
                    // Skip empty groups entirely so we don't emit ()
                    // If this was the first condition, also trim any dangling operator spacing
                    if (sql.endsWith(` ${cond.operator} `)) {
                        sql = sql.slice(0, -(` ${cond.operator} `.length));
                    }
                }
            }
            else if (cond.type === 'basic') {
                sql += `${cond.column} ${cond.conditionOperator} ?`;
                params.push(cond.value);
            }
            else if (cond.type === 'in') {
                const values = cond.value || [];
                if (values.length === 0) {
                    sql += `0=1`;
                }
                else {
                    sql += `${cond.column} IN (${values.map(() => '?').join(', ')})`;
                    params.push(...values);
                }
            }
            else if (cond.type === 'not_in') {
                const values = cond.value || [];
                if (values.length === 0) {
                    sql += `1=1`;
                }
                else {
                    sql += `${cond.column} NOT IN (${values.map(() => '?').join(', ')})`;
                    params.push(...values);
                }
            }
            else if (cond.type === 'null') {
                sql += `${cond.column} IS NULL`;
            }
            else if (cond.type === 'not_null') {
                sql += `${cond.column} IS NOT NULL`;
            }
            else if (cond.type === 'between') {
                sql += `${cond.column} BETWEEN ? AND ?`;
                params.push(cond.value[0], cond.value[1]);
            }
            else if (cond.type === 'not_between') {
                sql += `${cond.column} NOT BETWEEN ? AND ?`;
                params.push(cond.value[0], cond.value[1]);
            }
            else if (cond.type === 'raw') {
                sql += `(${cond.sql})`;
                params.push(...cond.bindings);
            }
        }
        return { sql, params };
    }
    async first() {
        // Check for Sushi first - no database needed
        if (!this.model.usesSushi() && !Eloquent.connection) {
            throw new Error('Database connection not initialized');
        }
        const one = this.clone().limit(1);
        const rows = await one.get();
        const result = rows[0];
        if (result) {
            await this.loadRelations([result], this.withRelations || []);
        }
        return result ?? null;
    }
    async firstOrFail() {
        const result = await this.first();
        if (!result) {
            throw new Error('No results found for query');
        }
        return result;
    }
    async firstOr(defaultValue) {
        const result = await this.first();
        if (result) {
            return result;
        }
        return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
    }
    toSql() {
        const { sql } = this.buildSelectSql({ includeOrderLimit: true });
        return sql;
    }
    toRawSql() {
        const { sql, params } = this.buildSelectSql({ includeOrderLimit: true });
        let rawSql = sql;
        for (const param of params) {
            const value = typeof param === 'string' ? `'${param}'` : param;
            rawSql = rawSql.replace('?', String(value));
        }
        return rawSql;
    }
    dump() {
        console.log('SQL:', this.toSql());
        console.log('Raw SQL:', this.toRawSql());
        return this;
    }
    dd() {
        this.dump();
        process.exit(1);
        throw new Error('Unreachable');
    }
    whereColumn(first, operatorOrSecond, second) {
        if (second === undefined) {
            // Two arguments: column1, column2 (equals)
            this.conditions.push({
                operator: 'AND',
                type: 'raw',
                sql: `${first} = ${operatorOrSecond}`,
                bindings: []
            });
        }
        else {
            // Three arguments: column1, operator, column2
            this.conditions.push({
                operator: 'AND',
                type: 'raw',
                sql: `${first} ${operatorOrSecond} ${second}`,
                bindings: []
            });
        }
        return this;
    }
    orWhereColumn(first, operatorOrSecond, second) {
        if (second === undefined) {
            this.conditions.push({
                operator: 'OR',
                type: 'raw',
                sql: `${first} = ${operatorOrSecond}`,
                bindings: []
            });
        }
        else {
            this.conditions.push({
                operator: 'OR',
                type: 'raw',
                sql: `${first} ${operatorOrSecond} ${second}`,
                bindings: []
            });
        }
        return this;
    }
    async get() {
        // Check if model uses Sushi (in-memory array data)
        if (this.model.usesSushi()) {
            return this.getSushi();
        }
        if (!Eloquent.connection)
            throw new Error('Database connection not initialized');
        const hasUnions = this.unions.length > 0;
        const main = this.buildSelectSql({ includeOrderLimit: !hasUnions });
        let sql = main.sql;
        let allParams = [...main.params];
        // Debug logging
        this.debugLog('Executing query', { sql, params: allParams, hasUnions });
        if (hasUnions) {
            for (const union of this.unions) {
                const unionData = union.query.buildSelectSql({ includeOrderLimit: false });
                sql += ` UNION ${union.all ? 'ALL ' : ''}${unionData.sql}`;
                allParams.push(...unionData.params);
            }
            // Apply ORDER BY / LIMIT / OFFSET at the end for the unioned result
            if (this.orderByClauses.length > 0) {
                const order = this.orderByClauses
                    .map(o => (o.column === 'RAND()' ? `RAND()` : `${o.column} ${o.direction}`))
                    .join(', ');
                sql += ` ORDER BY ${order}`;
            }
            if (this.limitValue !== undefined)
                sql += ` LIMIT ${this.limitValue}`;
            if (this.offsetValue !== undefined)
                sql += ` OFFSET ${this.offsetValue}`;
        }
        this.ensureReadOnlySql(sql, 'get');
        const [rows] = await Eloquent.connection.query(sql, allParams);
        const instances = rows.map(row => {
            const instance = new this.model();
            // Extract pivot data if requested
            if (this.pivotConfig) {
                const pivotObj = {};
                const prefix = `${this.pivotConfig.alias}__`;
                for (const key of Object.keys(row)) {
                    if (key.startsWith(prefix)) {
                        const pkey = key.slice(prefix.length);
                        pivotObj[pkey] = row[key];
                        delete row[key];
                    }
                }
                if (Object.keys(pivotObj).length > 0) {
                    instance[this.pivotConfig.alias] = pivotObj;
                }
            }
            // Zod validation/casting if schema provided
            const schema = this.model.schema;
            const data = schema ? schema.parse(row) : row;
            // Apply model accessors/mutators if available
            const casts = this.model.casts;
            if (casts) {
                for (const [key, castType] of Object.entries(casts)) {
                    if (key in data) {
                        data[key] = this.applyCast(data[key], castType);
                    }
                }
            }
            Object.assign(instance, data);
            return this.createProxiedInstance(instance);
        });
        await this.loadRelations(instances, this.withRelations || []);
        const collection = new Collection();
        collection.push(...instances);
        // Generate a unique collection ID and register the collection
        const collectionId = this.model.generateCollectionId();
        const collectionsRegistry = this.model.getCollectionsRegistry();
        collectionsRegistry.set(collectionId, instances);
        // Link instances back to the collection so autoloading can scope to the entire set
        for (const inst of instances) {
            try {
                Object.defineProperty(inst, '__collection', {
                    value: collection,
                    enumerable: false,
                    configurable: true,
                    writable: true
                });
                // Also store the collection ID as an enumerable property that survives serialization
                inst.__collectionId = collectionId;
            }
            catch {
                // no-op if defineProperty fails
            }
        }
        // Debug logging - query completed
        this.debugLog('Query completed', {
            resultCount: instances.length,
            hasRelations: (this.withRelations?.length ?? 0) > 0,
            relations: this.withRelations
        });
        return collection;
    }
    /**
     * Execute aggregate function against Sushi (in-memory array) data
     */
    async aggregateSushi(functionName, column) {
        const fetchedRows = await this.model.getRows();
        let rows = [...fetchedRows];
        // Apply conditions (filter)
        rows = this.applySushiConditions(rows, this.conditions);
        if (rows.length === 0) {
            return functionName === 'COUNT' ? 0 : 0;
        }
        switch (functionName) {
            case 'COUNT':
                return column === '*' ? rows.length : rows.filter(r => r[column] !== null && r[column] !== undefined).length;
            case 'SUM':
                return rows.reduce((sum, r) => sum + (Number(r[column]) || 0), 0);
            case 'AVG':
                const values = rows.map(r => Number(r[column]) || 0);
                return values.reduce((a, b) => a + b, 0) / values.length;
            case 'MAX':
                return Math.max(...rows.map(r => Number(r[column]) || 0));
            case 'MIN':
                return Math.min(...rows.map(r => Number(r[column]) || 0));
            default:
                return 0;
        }
    }
    /**
     * Execute query against Sushi (in-memory array) data
     * Supports: where, whereIn, whereNull, orderBy, limit, offset
     */
    async getSushi() {
        const fetchedRows = await this.model.getRows();
        let rows = [...fetchedRows];
        this.debugLog('Executing Sushi query', {
            model: this.model.name,
            totalRows: rows.length,
            conditions: this.conditions.length
        });
        // Apply conditions (filter)
        rows = this.applySushiConditions(rows, this.conditions);
        // Apply orderBy
        if (this.orderByClauses.length > 0) {
            rows = this.applySushiOrderBy(rows);
        }
        // Apply offset
        if (this.offsetValue !== undefined && this.offsetValue > 0) {
            rows = rows.slice(this.offsetValue);
        }
        // Apply limit
        if (this.limitValue !== undefined) {
            rows = rows.slice(0, this.limitValue);
        }
        // Select specific columns
        if (this.selectColumns.length > 0 && !this.selectColumns.includes('*')) {
            rows = rows.map(row => {
                const selected = {};
                for (const col of this.selectColumns) {
                    if (col in row) {
                        selected[col] = row[col];
                    }
                }
                return selected;
            });
        }
        // Create model instances
        const instances = rows.map(row => {
            const instance = new this.model();
            // Zod validation/casting if schema provided
            const schema = this.model.schema;
            const data = schema ? schema.parse(row) : row;
            // Apply model casts if available
            const casts = this.model.casts;
            if (casts) {
                for (const [key, castType] of Object.entries(casts)) {
                    if (key in data) {
                        data[key] = this.applyCast(data[key], castType);
                    }
                }
            }
            Object.assign(instance, data);
            return this.createProxiedInstance(instance);
        });
        // Load relations
        await this.loadRelations(instances, this.withRelations || []);
        const collection = new Collection();
        collection.push(...instances);
        // Generate collection ID and register
        const collectionId = this.model.generateCollectionId();
        const collectionsRegistry = this.model.getCollectionsRegistry();
        collectionsRegistry.set(collectionId, instances);
        // Link instances to collection
        for (const inst of instances) {
            try {
                Object.defineProperty(inst, '__collection', {
                    value: collection,
                    enumerable: false,
                    configurable: true,
                    writable: true
                });
                inst.__collectionId = collectionId;
            }
            catch {
                // no-op
            }
        }
        this.debugLog('Sushi query completed', { resultCount: instances.length });
        return collection;
    }
    /**
     * Apply conditions to Sushi rows (in-memory filtering)
     */
    applySushiConditions(rows, conditions) {
        if (conditions.length === 0)
            return rows;
        return rows.filter(row => {
            let result = true;
            for (let i = 0; i < conditions.length; i++) {
                const cond = conditions[i];
                const condResult = this.evaluateSushiCondition(row, cond);
                if (i === 0) {
                    result = condResult;
                }
                else if (cond.operator === 'AND') {
                    result = result && condResult;
                }
                else {
                    result = result || condResult;
                }
            }
            return result;
        });
    }
    /**
     * Evaluate a single condition against a Sushi row
     */
    evaluateSushiCondition(row, cond) {
        if ('group' in cond) {
            // Nested group
            const filtered = this.applySushiConditions([row], cond.group);
            return filtered.length > 0;
        }
        // Handle raw conditions - skip them for Sushi (can't evaluate raw SQL)
        if (cond.type === 'raw') {
            return true;
        }
        const value = row[cond.column];
        switch (cond.type) {
            case 'basic': {
                const op = cond.conditionOperator;
                const target = cond.value;
                switch (op) {
                    case '=': return value == target;
                    case '!=':
                    case '<>': return value != target;
                    case '>': return value > target;
                    case '>=': return value >= target;
                    case '<': return value < target;
                    case '<=': return value <= target;
                    case 'LIKE':
                    case 'like': {
                        if (typeof value !== 'string' || typeof target !== 'string')
                            return false;
                        // Convert SQL LIKE to regex
                        const pattern = target.replace(/%/g, '.*').replace(/_/g, '.');
                        return new RegExp(`^${pattern}$`, 'i').test(value);
                    }
                    default: return value == target;
                }
            }
            case 'in':
                return Array.isArray(cond.value) && cond.value.includes(value);
            case 'not_in':
                return Array.isArray(cond.value) && !cond.value.includes(value);
            case 'null':
                return value === null || value === undefined;
            case 'not_null':
                return value !== null && value !== undefined;
            case 'between':
                return value >= cond.value[0] && value <= cond.value[1];
            case 'not_between':
                return value < cond.value[0] || value > cond.value[1];
            default:
                return true;
        }
    }
    /**
     * Apply orderBy to Sushi rows (in-memory sorting)
     */
    applySushiOrderBy(rows) {
        return [...rows].sort((a, b) => {
            for (const clause of this.orderByClauses) {
                const aVal = a[clause.column];
                const bVal = b[clause.column];
                let comparison = 0;
                if (aVal === bVal) {
                    comparison = 0;
                }
                else if (aVal === null || aVal === undefined) {
                    comparison = 1;
                }
                else if (bVal === null || bVal === undefined) {
                    comparison = -1;
                }
                else if (typeof aVal === 'string' && typeof bVal === 'string') {
                    comparison = aVal.localeCompare(bVal);
                }
                else {
                    comparison = aVal < bVal ? -1 : 1;
                }
                if (comparison !== 0) {
                    return clause.direction === 'desc' ? -comparison : comparison;
                }
            }
            return 0;
        });
    }
    buildSelectSql(options) {
        const includeOrderLimit = options?.includeOrderLimit !== false;
        const table = this.tableName || this.model.table || this.model.name.toLowerCase() + 's';
        let sql = `SELECT ${this.isDistinct ? 'DISTINCT ' : ''}${this.selectColumns.join(', ')} FROM ${table}`;
        for (const j of this.joins) {
            if (j.type === 'cross') {
                sql += ` CROSS JOIN ${j.table}`;
            }
            else {
                sql += ` ${j.type.toUpperCase()} JOIN ${j.table} ON ${j.first} ${j.operator} ${j.second}`;
            }
        }
        const allConditions = this.conditions ? JSON.parse(JSON.stringify(this.conditions)) : [];
        // Apply global scopes
        const globalScopes = this.model.globalScopes;
        if (globalScopes) {
            for (const scope of globalScopes) {
                if (typeof scope === 'function') {
                    const scopeQuery = new QueryBuilder(this.model);
                    scope.call(this.model, scopeQuery);
                    if (scopeQuery.conditions.length > 0) {
                        allConditions.push({ operator: 'AND', group: scopeQuery.conditions });
                    }
                }
            }
        }
        const soft = this.model.softDeletes;
        if (soft) {
            if (this.trashedMode === 'default') {
                allConditions.push({ operator: 'AND', type: 'null', column: `${table}.deleted_at` });
            }
            else if (this.trashedMode === 'only') {
                allConditions.push({ operator: 'AND', type: 'not_null', column: `${table}.deleted_at` });
            }
        }
        const where = allConditions.length > 0 ? this.buildWhereClause(allConditions) : { sql: '', params: [] };
        if (where.sql)
            sql += ` WHERE ${where.sql}`;
        if (this.groupByColumns.length > 0)
            sql += ` GROUP BY ${this.groupByColumns.join(', ')}`;
        if (this.havingConditions.length > 0) {
            const having = this.buildWhereClause(this.havingConditions);
            if (having.sql)
                sql += ` HAVING ${having.sql}`;
            where.params.push(...having.params);
        }
        if (includeOrderLimit) {
            if (this.orderByClauses.length > 0) {
                const order = this.orderByClauses
                    .map(o => (o.column === 'RAND()' ? `RAND()` : `${o.column} ${o.direction}`))
                    .join(', ');
                sql += ` ORDER BY ${order}`;
            }
            if (this.limitValue !== undefined)
                sql += ` LIMIT ${this.limitValue}`;
            if (this.offsetValue !== undefined)
                sql += ` OFFSET ${this.offsetValue}`;
        }
        const params = [...this.selectBindings, ...where.params];
        return { sql, params };
    }
    ensureReadOnlySnippet(snippet, context) {
        const text = (snippet || '').toLowerCase();
        if (text.includes(';')) {
            throw new Error(`Read-only ORM violation in ${context}: semicolons are not allowed`);
        }
        for (const k of QueryBuilder.FORBIDDEN_SQL) {
            // Use word boundaries to avoid false positives like "created_at" matching "create"
            const regex = new RegExp(`\\b${k}\\b`, 'i');
            if (regex.test(text)) {
                throw new Error(`Read-only ORM violation in ${context}: disallowed keyword '${k}'`);
            }
        }
    }
    ensureReadOnlySql(sql, context) {
        const lc = sql.toLowerCase().trim();
        if (!lc.startsWith('select')) {
            throw new Error(`Read-only ORM violation in ${context}: only SELECT statements are permitted`);
        }
        this.ensureReadOnlySnippet(sql, context);
    }
    createProxiedInstance(instance) {
        const relationConfigs = new Map();
        const accessorCache = new Map();
        // Get all possible relation names from the model
        const proto = instance.constructor.prototype;
        for (const key of Object.getOwnPropertyNames(proto)) {
            const config = Eloquent.getRelationConfig(instance.constructor, key);
            if (config) {
                relationConfigs.set(key, config);
            }
        }
        // Helper to convert snake_case to PascalCase for accessor lookup
        const toPascalCase = (str) => {
            return str.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
        };
        // Helper to find accessor method name for a property
        const findAccessor = (prop) => {
            if (accessorCache.has(prop)) {
                return accessorCache.get(prop);
            }
            // Try getXxxAttribute format (e.g., full_name -> getFullNameAttribute)
            const accessorName = `get${toPascalCase(prop)}Attribute`;
            if (typeof proto[accessorName] === 'function') {
                accessorCache.set(prop, accessorName);
                return accessorName;
            }
            accessorCache.set(prop, null);
            return null;
        };
        // Track loading promises per relation
        const loadingPromises = new Map();
        return new Proxy(instance, {
            get: (target, prop) => {
                // Check if this is a relationship
                if (relationConfigs.has(prop)) {
                    // Check if the relation data has been loaded (stored as own property on instance)
                    const hasLoadedData = Object.prototype.hasOwnProperty.call(target, prop);
                    if (hasLoadedData) {
                        // Return the loaded relation data
                        return target[prop];
                    }
                    // Check for auto-loading
                    if (this.shouldAutoLoad(target, prop)) {
                        // Start loading if not already loading
                        if (!loadingPromises.has(prop)) {
                            const loadPromise = this.autoLoadRelation(target, prop);
                            loadingPromises.set(prop, loadPromise);
                        }
                        // Return a thenable proxy that:
                        // 1. Can be awaited: await user.posts
                        // 2. Acts like the relation for chaining: user.posts().where(...)
                        const relationMethod = target[prop].bind(target);
                        const loadPromise = loadingPromises.get(prop);
                        // Create a thenable that resolves to the loaded data
                        const thenable = Object.assign(function (...args) {
                            // Allow calling as method for chaining
                            return relationMethod(...args);
                        }, {
                            then: (resolve, reject) => {
                                return loadPromise
                                    .then(() => {
                                    // After load, return the data from the instance
                                    const data = target[prop];
                                    resolve(data);
                                })
                                    .catch(reject);
                            },
                            catch: (reject) => {
                                return loadPromise.catch(reject);
                            }
                        });
                        return thenable;
                    }
                    // Return the relation method for chainable queries
                    // User can call user.posts().get() for explicit loading
                    return target[prop];
                }
                // Check for Laravel-style accessor (getXxxAttribute)
                // Only if prop is not already defined on target (allows native getters to take precedence)
                if (typeof prop === 'string' && !Object.getOwnPropertyDescriptor(proto, prop)?.get) {
                    const accessor = findAccessor(prop);
                    if (accessor) {
                        return target[accessor]();
                    }
                }
                return target[prop];
            }
        });
    }
    shouldAutoLoad(instance, relationName) {
        // Check if global auto-loading is enabled or instance belongs to a collection with auto-loading
        const globalEnabled = Eloquent.automaticallyEagerLoadRelationshipsEnabled;
        const collectionAutoLoad = instance.__collectionAutoLoad;
        return globalEnabled || collectionAutoLoad;
    }
    async autoLoadRelation(instance, relationName) {
        const collection = instance.__collection;
        const globalEnabled = Eloquent.automaticallyEagerLoadRelationshipsEnabled;
        // Check if we should load for the entire collection
        const shouldLoadCollection = collection && (globalEnabled ||
            (typeof collection.isRelationshipAutoloadingEnabled === 'function' && collection.isRelationshipAutoloadingEnabled()));
        if (shouldLoadCollection) {
            // Load for the entire collection (batch load - prevents N+1)
            await this.loadRelations(collection, [relationName]);
        }
        else {
            // Load for just this instance
            await this.loadRelations([instance], [relationName]);
        }
    }
}
QueryBuilder.IN_CHUNK_SIZE = 1000;
QueryBuilder.FORBIDDEN_SQL = [
    'insert', 'update', 'delete', 'replace', 'create', 'drop', 'alter', 'truncate',
    'grant', 'revoke', 'load data', 'into outfile'
];
class Collection extends Array {
    constructor() {
        super(...arguments);
        this.relationshipAutoloadingEnabled = false;
    }
    withRelationshipAutoloading() {
        this.relationshipAutoloadingEnabled = true;
        // Mark all instances in this collection for auto-loading
        for (const instance of this) {
            try {
                Object.defineProperty(instance, '__collectionAutoLoad', {
                    value: true,
                    enumerable: false,
                    configurable: true,
                    writable: true
                });
                Object.defineProperty(instance, '__collection', {
                    value: this,
                    enumerable: false,
                    configurable: true,
                    writable: true
                });
            }
            catch {
                // ignore
            }
        }
        return this;
    }
    isRelationshipAutoloadingEnabled() {
        return this.relationshipAutoloadingEnabled || Eloquent.automaticallyEagerLoadRelationshipsEnabled;
    }
}
// Static properties for batching
const LOAD_BATCH_KEY = Symbol('loadBatch');
const LOADED_RELATIONS_REGISTRY_KEY = Symbol('loadedRelationsRegistry');
const BATCH_TIMER_KEY = Symbol('batchTimer');
const LOADING_PROMISES_KEY = Symbol('loadingPromises');
const COLLECTIONS_REGISTRY_KEY = Symbol('collectionsRegistry');
let COLLECTION_ID_COUNTER = 0;
class ThroughBuilder {
    constructor(instance, throughRelation) {
        this.instance = instance;
        this.throughRelation = throughRelation;
    }
    has(finalRelation) {
        const throughModel = this.instance.constructor;
        const throughConfig = Eloquent.getRelationConfig(throughModel, this.throughRelation);
        if (!throughConfig)
            throw new Error(`Through relation ${this.throughRelation} not found`);
        const throughClass = throughConfig.model;
        const finalConfig = Eloquent.getRelationConfig(throughClass, finalRelation);
        if (!finalConfig)
            throw new Error(`Final relation ${finalRelation} not found`);
        const finalClass = finalConfig.model;
        const isOne = finalConfig.type === 'belongsTo' || finalConfig.type === 'hasOne';
        const firstKey = throughConfig.foreignKey;
        const secondKey = finalConfig.type === 'belongsTo' ? `${throughClass.name.toLowerCase()}_id` : finalConfig.foreignKey;
        const localKey = throughConfig.localKey || 'id';
        const secondLocalKey = finalConfig.type === 'belongsTo' ? (finalConfig.ownerKey || 'id') : (finalConfig.localKey || 'id');
        if (isOne) {
            return this.instance.hasOneThrough(finalClass, throughClass, firstKey, secondKey, localKey, secondLocalKey);
        }
        else {
            return this.instance.hasManyThrough(finalClass, throughClass, firstKey, secondKey, localKey, secondLocalKey);
        }
    }
}
class Eloquent {
    /**
     * Check if this model uses Sushi (in-memory array data)
     * Override this method to return true for API-based Sushi models
     */
    static usesSushi() {
        // Check if model has static rows array
        if (Array.isArray(this.rows)) {
            return true;
        }
        // Check if model has overridden getRows (not the base Eloquent.getRows)
        const hasOwnGetRows = Object.prototype.hasOwnProperty.call(this, 'getRows') ||
            (this.getRows !== Eloquent.getRows);
        return hasOwnGetRows;
    }
    /**
     * Get the Sushi rows for this model (async - can fetch from API)
     * Override this method to fetch data from an API or other async source
     */
    static async getRows() {
        return this.rows || [];
    }
    static automaticallyEagerLoadRelationships() {
        Eloquent.automaticallyEagerLoadRelationshipsEnabled = true;
    }
    static isAutomaticallyEagerLoadRelationshipsEnabled() {
        return Eloquent.automaticallyEagerLoadRelationshipsEnabled;
    }
    static enableDebug(logger) {
        Eloquent.debugEnabled = true;
        if (logger) {
            Eloquent.debugLogger = logger;
        }
    }
    static disableDebug() {
        Eloquent.debugEnabled = false;
    }
    static raw(value) {
        return value;
    }
    // Batching system for loadForAll
    static getLoadBatch() {
        // Use globalThis if available, otherwise use a module-level variable
        if (typeof globalThis !== 'undefined') {
            if (!globalThis[LOAD_BATCH_KEY]) {
                globalThis[LOAD_BATCH_KEY] = [];
            }
            return globalThis[LOAD_BATCH_KEY];
        }
        // Fallback: use a static property on the Eloquent class
        if (!Eloquent[LOAD_BATCH_KEY]) {
            Eloquent[LOAD_BATCH_KEY] = [];
        }
        return Eloquent[LOAD_BATCH_KEY];
    }
    // Global registry for tracking loaded relations by model and ID
    static getLoadedRelationsRegistry() {
        if (typeof globalThis !== 'undefined') {
            if (!globalThis[LOADED_RELATIONS_REGISTRY_KEY]) {
                globalThis[LOADED_RELATIONS_REGISTRY_KEY] = {};
            }
            return globalThis[LOADED_RELATIONS_REGISTRY_KEY];
        }
        if (!Eloquent[LOADED_RELATIONS_REGISTRY_KEY]) {
            Eloquent[LOADED_RELATIONS_REGISTRY_KEY] = {};
        }
        return Eloquent[LOADED_RELATIONS_REGISTRY_KEY];
    }
    static markRelationsAsLoaded(modelName, instanceId, relationNames) {
        const registry = this.getLoadedRelationsRegistry();
        if (!registry[modelName]) {
            registry[modelName] = {};
        }
        if (!registry[modelName][instanceId]) {
            registry[modelName][instanceId] = {};
        }
        relationNames.forEach(name => {
            registry[modelName][instanceId][name] = true;
        });
    }
    static areRelationsLoaded(modelName, instanceId, relationNames) {
        const registry = this.getLoadedRelationsRegistry();
        const modelRegistry = registry[modelName];
        if (!modelRegistry || !modelRegistry[instanceId]) {
            return false;
        }
        return relationNames.every(name => modelRegistry[instanceId][name] === true);
    }
    // Get the loading promises cache
    static getLoadingPromises() {
        if (typeof globalThis !== 'undefined') {
            if (!globalThis[LOADING_PROMISES_KEY]) {
                globalThis[LOADING_PROMISES_KEY] = new Map();
            }
            return globalThis[LOADING_PROMISES_KEY];
        }
        if (!Eloquent[LOADING_PROMISES_KEY]) {
            Eloquent[LOADING_PROMISES_KEY] = new Map();
        }
        return Eloquent[LOADING_PROMISES_KEY];
    }
    // Generate a cache key for a loading operation
    static getLoadingCacheKey(modelName, instanceIds, relationNames) {
        const sortedIds = [...instanceIds].sort();
        const sortedRelations = [...relationNames].sort();
        return `${modelName}:${sortedIds.join(',')}:${sortedRelations.join(',')}`;
    }
    // Get the collections registry
    static getCollectionsRegistry() {
        if (typeof globalThis !== 'undefined') {
            if (!globalThis[COLLECTIONS_REGISTRY_KEY]) {
                globalThis[COLLECTIONS_REGISTRY_KEY] = new Map();
            }
            return globalThis[COLLECTIONS_REGISTRY_KEY];
        }
        if (!Eloquent[COLLECTIONS_REGISTRY_KEY]) {
            Eloquent[COLLECTIONS_REGISTRY_KEY] = new Map();
        }
        return Eloquent[COLLECTIONS_REGISTRY_KEY];
    }
    // Generate a unique collection ID
    static generateCollectionId() {
        return `collection_${++COLLECTION_ID_COUNTER}_${Date.now()}`;
    }
    static addToLoadBatch(instances, relations) {
        const batch = this.getLoadBatch();
        // Check if we already have a batch item for these instances and relations
        const existingItem = batch.find(item => {
            // Check if instances are the same (same length and all instances match)
            if (item.instances.length !== instances.length)
                return false;
            const itemIds = item.instances.map(inst => inst.id || inst).sort();
            const instancesIds = instances.map(inst => inst.id || inst).sort();
            if (itemIds.join(',') !== instancesIds.join(','))
                return false;
            // Check if relations are the same
            return JSON.stringify(item.relations) === JSON.stringify(relations);
        });
        if (!existingItem) {
            batch.push({ instances, relations });
        }
        // Schedule flush if not already scheduled
        this.scheduleBatchFlush();
    }
    static scheduleBatchFlush() {
        // Check if already scheduled
        const isScheduled = typeof globalThis !== 'undefined' ?
            globalThis[BATCH_TIMER_KEY] :
            Eloquent[BATCH_TIMER_KEY];
        if (isScheduled) {
            return; // Already scheduled
        }
        const flushBatch = () => {
            const batch = this.getLoadBatch();
            if (batch.length > 0) {
                this.flushLoadBatch();
            }
            // Clear the timer flag
            if (typeof globalThis !== 'undefined') {
                globalThis[BATCH_TIMER_KEY] = false;
            }
            else {
                Eloquent[BATCH_TIMER_KEY] = false;
            }
        };
        // Set the timer flag
        if (typeof globalThis !== 'undefined') {
            globalThis[BATCH_TIMER_KEY] = true;
        }
        else {
            Eloquent[BATCH_TIMER_KEY] = true;
        }
        // Use the most appropriate async scheduling mechanism
        if (typeof process !== 'undefined' && process.nextTick) {
            process.nextTick(flushBatch);
        }
        else if (typeof globalThis !== 'undefined' && typeof globalThis.setImmediate !== 'undefined') {
            globalThis.setImmediate(flushBatch);
        }
        else {
            setTimeout(flushBatch, 0);
        }
    }
    static async flushLoadBatch() {
        const batch = this.getLoadBatch();
        if (batch.length === 0)
            return;
        // Clear the batch first to prevent recursion
        this.getLoadBatch().length = 0;
        // Group by instances to avoid loading the same instances multiple times
        const instanceGroups = new Map();
        for (const item of batch) {
            const key = item.instances.map(inst => inst.id || inst).sort().join(',');
            if (!instanceGroups.has(key)) {
                instanceGroups.set(key, { instances: item.instances, relations: new Set() });
            }
            const group = instanceGroups.get(key);
            if (typeof item.relations === 'string') {
                group.relations.add(item.relations);
            }
            else if (Array.isArray(item.relations)) {
                item.relations.forEach(rel => group.relations.add(rel));
            }
            else {
                // Handle object form
                Object.keys(item.relations).forEach(rel => group.relations.add(rel));
            }
        }
        // Execute each group
        for (const [key, group] of instanceGroups) {
            const relationsArray = Array.from(group.relations);
            await this.loadMissing(group.instances, relationsArray);
        }
    }
    // Public method to manually flush the load batch (useful for testing)
    static async flushLoadForAllBatch() {
        await this.flushLoadBatch();
    }
    // Public method to clear the load batch without executing (useful for cleanup)
    static clearLoadForAllBatch() {
        this.getLoadBatch().length = 0;
        // Clear the timer flag as well
        if (typeof globalThis !== 'undefined') {
            globalThis[BATCH_TIMER_KEY] = false;
        }
        else {
            Eloquent[BATCH_TIMER_KEY] = false;
        }
    }
    static async init(connection, morphs) {
        // Require an already-created connection
        Eloquent.connection = connection;
        if (morphs) {
            Eloquent.morphMap = { ...morphs };
        }
    }
    static useConnection(connection, morphs) {
        Eloquent.connection = connection;
        if (morphs) {
            Eloquent.morphMap = { ...morphs };
        }
    }
    // Infer relation config from instance relation methods (Laravel-style),
    // falling back to optional static relations map if present.
    static getRelationConfig(model, relationName) {
        // First check static relations map
        const staticMap = model.relations && model.relations[relationName];
        if (staticMap)
            return staticMap;
        // Try to get config from a Relation instance (new class-based approach)
        try {
            const proto = model.prototype;
            const relationFn = proto && proto[relationName];
            if (typeof relationFn === 'function') {
                // Create a minimal instance to call the relation method
                const fakeInstance = Object.create(proto);
                // Set a dummy id so constraints can be added
                fakeInstance.id = 0;
                const result = relationFn.call(fakeInstance);
                // Check if result is a Relation instance
                if (result && result instanceof Relation) {
                    return result.getConfig();
                }
            }
        }
        catch {
            // Fall through to describeRelation
        }
        // Fall back to describeRelation for backward compatibility
        return Eloquent.describeRelation(model, relationName);
    }
    static describeRelation(model, relationName) {
        const proto = model.prototype;
        const relationFn = proto && proto[relationName];
        if (typeof relationFn !== 'function')
            return null;
        if (relationName === 'constructor')
            return null;
        const makeStub = (meta) => {
            const target = { __relation: meta };
            let proxy;
            proxy = new Proxy(target, {
                get(t, prop) {
                    if (prop in t)
                        return t[prop];
                    // Return a chainable no-op function for any method access
                    return (..._args) => proxy;
                }
            });
            return proxy;
        };
        const fake = Object.create(proto);
        fake.belongsTo = (related, foreignKey, ownerKey = 'id') => {
            const resolvedRelated = typeof related === 'string' ? related : related;
            return makeStub({ type: 'belongsTo', model: resolvedRelated, foreignKey, ownerKey });
        };
        fake.hasMany = (related, foreignKey, localKey = 'id') => {
            const resolvedRelated = typeof related === 'string' ? related : related;
            return makeStub({ type: 'hasMany', model: resolvedRelated, foreignKey, localKey });
        };
        fake.hasOne = (related, foreignKey, localKey = 'id') => {
            const resolvedRelated = typeof related === 'string' ? related : related;
            return makeStub({ type: 'hasOne', model: resolvedRelated, foreignKey, localKey });
        };
        fake.morphOne = (related, name, typeColumn, idColumn, localKey = 'id') => {
            const resolvedRelated = typeof related === 'string' ? related : related;
            return makeStub({ type: 'morphOne', model: resolvedRelated, morphName: name, typeColumn, idColumn, localKey });
        };
        fake.morphMany = (related, name, typeColumn, idColumn, localKey = 'id') => {
            const resolvedRelated = typeof related === 'string' ? related : related;
            return makeStub({ type: 'morphMany', model: resolvedRelated, morphName: name, typeColumn, idColumn, localKey });
        };
        fake.morphOneOfMany = (related, name, column = 'created_at', aggregate = 'max', typeColumn, idColumn, localKey = 'id') => {
            const resolvedRelated = typeof related === 'string' ? related : related;
            return makeStub({ type: 'morphOneOfMany', model: resolvedRelated, morphName: name, column, aggregate, typeColumn, idColumn, localKey });
        };
        fake.latestMorphOne = (related, name, column = 'created_at', typeColumn, idColumn, localKey = 'id') => {
            const resolvedRelated = typeof related === 'string' ? related : related;
            return makeStub({ type: 'morphOneOfMany', model: resolvedRelated, morphName: name, column, aggregate: 'max', typeColumn, idColumn, localKey });
        };
        fake.oldestMorphOne = (related, name, column = 'created_at', typeColumn, idColumn, localKey = 'id') => {
            const resolvedRelated = typeof related === 'string' ? related : related;
            return makeStub({ type: 'morphOneOfMany', model: resolvedRelated, morphName: name, column, aggregate: 'min', typeColumn, idColumn, localKey });
        };
        fake.morphTo = (name, typeColumn, idColumn) => makeStub({ type: 'morphTo', morphName: name, typeColumn, idColumn });
        fake.belongsToMany = (related, table, foreignPivotKey, relatedPivotKey, parentKey = 'id', relatedKey = 'id') => {
            const resolvedRelated = typeof related === 'string' ? related : related;
            return makeStub({ type: 'belongsToMany', model: resolvedRelated, table, foreignPivotKey, relatedPivotKey, parentKey, relatedKey });
        };
        let result;
        try {
            result = relationFn.call(fake);
        }
        catch {
            return null;
        }
        if (result && typeof result === 'object' && '__relation' in result) {
            return result.__relation;
        }
        return null;
    }
    belongsTo(related, foreignKey, ownerKey = 'id') {
        if (typeof related === 'string') {
            // Resolve model from morph map
            const ModelClass = Eloquent.getModelForMorphType(related);
            if (!ModelClass) {
                throw new Error(`Model '${related}' not found in morph map`);
            }
            return new BelongsTo(this, ModelClass, foreignKey, ownerKey);
        }
        else {
            return new BelongsTo(this, related, foreignKey, ownerKey);
        }
    }
    hasMany(related, foreignKey, localKey = 'id') {
        if (typeof related === 'string') {
            // Resolve model from morph map
            const ModelClass = Eloquent.getModelForMorphType(related);
            if (!ModelClass) {
                throw new Error(`Model '${related}' not found in morph map`);
            }
            return new HasMany(this, ModelClass, foreignKey, localKey);
        }
        else {
            return new HasMany(this, related, foreignKey, localKey);
        }
    }
    hasOne(related, foreignKey, localKey = 'id') {
        if (typeof related === 'string') {
            // Resolve model from morph map
            const ModelClass = Eloquent.getModelForMorphType(related);
            if (!ModelClass) {
                throw new Error(`Model '${related}' not found in morph map`);
            }
            return new HasOne(this, ModelClass, foreignKey, localKey);
        }
        else {
            return new HasOne(this, related, foreignKey, localKey);
        }
    }
    hasOneOfMany(related, foreignKey, column = 'created_at', aggregate = 'max', localKey = 'id') {
        if (typeof related === 'string') {
            // Resolve model from morph map
            const ModelClass = Eloquent.getModelForMorphType(related);
            if (!ModelClass) {
                throw new Error(`Model '${related}' not found in morph map`);
            }
            return ModelClass.query().where(foreignKey, this[localKey]).ofMany(column, aggregate);
        }
        else {
            return related.query().where(foreignKey, this[localKey]).ofMany(column, aggregate);
        }
    }
    latestOfMany(related, foreignKey, column = 'created_at', localKey = 'id') {
        return this.hasOneOfMany(related, foreignKey, column, 'max', localKey);
    }
    oldestOfMany(related, foreignKey, column = 'created_at', localKey = 'id') {
        return this.hasOneOfMany(related, foreignKey, column, 'min', localKey);
    }
    morphOne(related, name, typeColumn, idColumn, localKey = 'id') {
        if (typeof related === 'string') {
            // Resolve model from morph map
            const ModelClass = Eloquent.getModelForMorphType(related);
            if (!ModelClass) {
                throw new Error(`Model '${related}' not found in morph map`);
            }
            return new MorphOne(this, ModelClass, name, typeColumn, idColumn, localKey);
        }
        else {
            return new MorphOne(this, related, name, typeColumn, idColumn, localKey);
        }
    }
    morphOneOfMany(related, name, column = 'created_at', aggregate = 'max', typeColumn, idColumn, localKey = 'id') {
        if (typeof related === 'string') {
            // Resolve model from morph map
            const ModelClass = Eloquent.getModelForMorphType(related);
            if (!ModelClass) {
                throw new Error(`Model '${related}' not found in morph map`);
            }
            return new MorphOneOfMany(this, ModelClass, name, column, aggregate, typeColumn, idColumn, localKey);
        }
        else {
            return new MorphOneOfMany(this, related, name, column, aggregate, typeColumn, idColumn, localKey);
        }
    }
    latestMorphOne(related, name, column = 'created_at', typeColumn, idColumn, localKey = 'id') {
        return this.morphOneOfMany(related, name, column, 'max', typeColumn, idColumn, localKey);
    }
    oldestMorphOne(related, name, column = 'created_at', typeColumn, idColumn, localKey = 'id') {
        return this.morphOneOfMany(related, name, column, 'min', typeColumn, idColumn, localKey);
    }
    morphMany(related, name, typeColumn, idColumn, localKey = 'id') {
        if (typeof related === 'string') {
            // Resolve model from morph map
            const ModelClass = Eloquent.getModelForMorphType(related);
            if (!ModelClass) {
                throw new Error(`Model '${related}' not found in morph map`);
            }
            return new MorphMany(this, ModelClass, name, typeColumn, idColumn, localKey);
        }
        else {
            return new MorphMany(this, related, name, typeColumn, idColumn, localKey);
        }
    }
    morphTo(name, typeColumn, idColumn) {
        return new MorphTo(this, name, typeColumn, idColumn);
    }
    static registerMorphMap(map) {
        Eloquent.morphMap = { ...Eloquent.morphMap, ...map };
    }
    static getMorphTypeForModel(model) {
        const explicit = model.morphClass;
        if (explicit)
            return explicit;
        for (const [alias, ctor] of Object.entries(Eloquent.morphMap)) {
            if (ctor === model)
                return alias;
        }
        return model.name; // fallback to class name
    }
    static getModelForMorphType(type) {
        if (!type)
            return null;
        if (Eloquent.morphMap[type])
            return Eloquent.morphMap[type];
        // Try to resolve from the morph map values (in case the key format doesn't match)
        for (const [key, modelClass] of Object.entries(Eloquent.morphMap)) {
            if (key === type || modelClass.morphClass === type) {
                return modelClass;
            }
        }
        // fallback: search known constructors by morphClass/static
        // Note: without a central registry, we rely on provided map/global.
        return null;
    }
    static getPossibleMorphTypesForModel(model) {
        const set = new Set();
        const explicitTypes = model.morphTypes;
        const explicitClass = model.morphClass;
        if (explicitTypes && Array.isArray(explicitTypes)) {
            for (const t of explicitTypes)
                if (t)
                    set.add(t);
        }
        if (explicitClass)
            set.add(explicitClass);
        for (const [alias, ctor] of Object.entries(Eloquent.morphMap)) {
            if (ctor === model)
                set.add(alias);
        }
        const className = model.name;
        set.add(className);
        return Array.from(set);
    }
    hasOneThrough(related, through, firstKey, secondKey, localKey = 'id', secondLocalKey = 'id') {
        // Resolve models from morph map if strings are provided
        const ResolvedRelated = typeof related === 'string'
            ? Eloquent.getModelForMorphType(related)
            : related;
        const ResolvedThrough = typeof through === 'string'
            ? Eloquent.getModelForMorphType(through)
            : through;
        if (!ResolvedRelated || !ResolvedThrough) {
            throw new Error(`Models '${related}' or '${through}' not found in morph map`);
        }
        return new HasOneThrough(this, ResolvedRelated, ResolvedThrough, firstKey, secondKey, localKey, secondLocalKey);
    }
    hasManyThrough(related, through, firstKey, secondKey, localKey = 'id', secondLocalKey = 'id') {
        // Resolve models from morph map if strings are provided
        const ResolvedRelated = typeof related === 'string'
            ? Eloquent.getModelForMorphType(related)
            : related;
        const ResolvedThrough = typeof through === 'string'
            ? Eloquent.getModelForMorphType(through)
            : through;
        if (!ResolvedRelated || !ResolvedThrough) {
            throw new Error(`Models '${related}' or '${through}' not found in morph map`);
        }
        return new HasManyThrough(this, ResolvedRelated, ResolvedThrough, firstKey, secondKey, localKey, secondLocalKey);
    }
    belongsToMany(related, table, foreignPivotKey, relatedPivotKey, parentKey = 'id', relatedKey = 'id') {
        if (typeof related === 'string') {
            // Resolve model from morph map
            const ModelClass = Eloquent.getModelForMorphType(related);
            if (!ModelClass) {
                throw new Error(`Model '${related}' not found in morph map`);
            }
            return new BelongsToMany(this, ModelClass, table, foreignPivotKey, relatedPivotKey, parentKey, relatedKey);
        }
        else {
            return new BelongsToMany(this, related, table, foreignPivotKey, relatedPivotKey, parentKey, relatedKey);
        }
    }
    static getProperty(key) {
        return this[key];
    }
    through(relationship) {
        return new ThroughBuilder(this, relationship);
    }
    static query() {
        const qb = new QueryBuilder(this);
        // Apply default eager loading if defined
        const defaultWith = this.with;
        if (defaultWith && Array.isArray(defaultWith) && defaultWith.length > 0) {
            qb.with(defaultWith);
        }
        return qb;
    }
    toJSON() {
        const hidden = this.constructor.hidden || [];
        const out = {};
        for (const key of Object.keys(this)) {
            if (hidden.includes(key))
                continue;
            out[key] = this[key];
        }
        return out;
    }
    async load(relations) {
        await this.constructor.load([this], relations);
        return this;
    }
    async loadMissing(relations) {
        await this.constructor.loadMissing([this], relations);
        return this;
    }
    async loadCount(relations) {
        await this.constructor.loadCount([this], relations);
        return this;
    }
    async loadForAll(...args) {
        // Normalize arguments
        const relations = args.length > 1 ? args : args[0];
        const collection = this.__collection;
        const collectionId = this.__collectionId;
        const modelName = this.constructor.name;
        const instanceId = this.id;
        // Parse relation names to check if already loaded (top-level only for __relations check)
        const relationNames = this.constructor.parseRelationNames(relations);
        // Parse full relation names including nested paths for cache key
        const fullRelationNames = this.constructor.parseFullRelationNames(relations);
        // Check if already loaded via collection OR global registry
        let alreadyLoaded = false;
        let targets = [this];
        // Try to get the collection from the registry using the collection ID
        if (collectionId) {
            const collectionsRegistry = Eloquent.getCollectionsRegistry();
            const registeredCollection = collectionsRegistry.get(collectionId);
            if (registeredCollection && registeredCollection.length > 0) {
                targets = registeredCollection;
            }
        }
        else if (collection && collection.length) {
            // Fallback to __collection property if available
            targets = collection;
        }
        // Check if relations are already loaded on the first target
        if (targets.length > 1) {
            const firstTarget = targets[0];
            alreadyLoaded = relationNames.every(name => {
                const rel = firstTarget.__relations || {};
                return name in rel;
            });
            // Also populate registry for future serialized instances
            if (alreadyLoaded && instanceId !== undefined) {
                targets.forEach((target) => {
                    const targetId = target.id;
                    if (targetId !== undefined) {
                        Eloquent.markRelationsAsLoaded(modelName, targetId, relationNames);
                    }
                });
            }
        }
        else {
            // Use global registry for caching when we only have this instance
            alreadyLoaded = (instanceId !== undefined) && Eloquent.areRelationsLoaded(modelName, instanceId, relationNames);
        }
        // If not loaded via registry, check if any other instances of same model+id have the relations
        if (!alreadyLoaded && instanceId !== undefined) {
            const registry = Eloquent.getLoadedRelationsRegistry();
            const modelRegistry = registry[modelName];
            if (modelRegistry && modelRegistry[instanceId]) {
                // Mark relations as loaded on this instance if they're loaded for this ID
                const loadedFromRegistry = relationNames.every(name => modelRegistry[instanceId][name] === true);
                if (loadedFromRegistry) {
                    alreadyLoaded = true;
                    // Mark relations as loaded on this instance
                    const holder = this.__relations || {};
                    if (!this.__relations) {
                        Object.defineProperty(this, '__relations', { value: holder, enumerable: false, configurable: true, writable: true });
                    }
                    relationNames.forEach(name => {
                        holder[name] = true;
                    });
                    // Debug logging for registry hits
                    if (Eloquent.debugEnabled) {
                        Eloquent.debugLogger(`loadForAll: Using registry cached data for relations [${fullRelationNames.join(', ')}] on ${this.constructor.name}#${instanceId}`);
                    }
                }
            }
        }
        // Debug logging for loadForAll behavior
        if (Eloquent.debugEnabled) {
            const targetCount = targets.length;
            const instanceId = this.id || 'unknown';
            if (alreadyLoaded) {
                Eloquent.debugLogger(`loadForAll: Using cached data for relations [${fullRelationNames.join(', ')}] on ${this.constructor.name}#${instanceId} (${targetCount} instances in collection)`);
            }
            else {
                Eloquent.debugLogger(`loadForAll: Making fresh DB call for relations [${fullRelationNames.join(', ')}] on ${this.constructor.name}#${instanceId} (loading for ${targetCount} instances)`);
            }
        }
        // If not already loaded, coordinate loading across all instances
        if (!alreadyLoaded) {
            const targetIds = targets.map((t) => t.id).filter(id => id !== undefined);
            // Use collection ID for the cache key if available, otherwise use instance ID
            // Use full relation names (including nested paths) for the cache key
            const cacheKey = collectionId
                ? `${collectionId}:${fullRelationNames.sort().join(',')}`
                : instanceId !== undefined
                    ? Eloquent.getLoadingCacheKey(modelName, [instanceId], fullRelationNames)
                    : null;
            const loadingPromises = Eloquent.getLoadingPromises();
            // Check if there's already a load in progress for this collection/instance
            if (cacheKey && loadingPromises.has(cacheKey)) {
                // Another call is already loading - wait for it
                if (Eloquent.debugEnabled) {
                    Eloquent.debugLogger(`loadForAll: Waiting for concurrent load operation for relations [${fullRelationNames.join(', ')}] on ${this.constructor.name}#${instanceId}`);
                }
                await loadingPromises.get(cacheKey);
            }
            else if (cacheKey) {
                // We're the first - create the promise and store it
                const loadPromise = (async () => {
                    try {
                        if (Eloquent.debugEnabled) {
                            Eloquent.debugLogger(`loadForAll: Starting DB load for relations [${fullRelationNames.join(', ')}] on ${this.constructor.name} (${targetIds.length} instances)`);
                        }
                        await this.constructor.load(targets, relations);
                        // Mark relations as loaded in the global registry for all targets
                        targets.forEach((target) => {
                            const targetId = target.id;
                            if (targetId !== undefined) {
                                Eloquent.markRelationsAsLoaded(modelName, targetId, relationNames);
                            }
                        });
                    }
                    finally {
                        // Remove the promise from the cache once complete
                        loadingPromises.delete(cacheKey);
                    }
                })();
                // Store the promise immediately (before any await)
                loadingPromises.set(cacheKey, loadPromise);
                await loadPromise;
            }
            else {
                // No cache key, just load directly
                await this.constructor.load(targets, relations);
            }
        }
        // Return the instance with loaded relations available
        return this;
    }
    static async load(instances, relations) {
        if (instances.length === 0)
            return;
        const model = instances[0].constructor;
        const qb = model.query();
        // Apply the relations to the query builder
        qb.with(relations);
        // Load the relations by calling get() on a query that matches the instances
        // This is a simplified approach - get all instances with relations loaded
        const ids = instances.map(inst => inst.id).filter(id => id !== null && id !== undefined);
        if (ids.length === 0)
            return;
        const loadedInstances = await model.query().with(relations).whereIn('id', ids).get();
        // Create a map of loaded instances by ID
        const loadedMap = new Map(loadedInstances.map(inst => [inst.id, inst]));
        // Determine relation names to copy onto instances
        const names = this.parseRelationNames(relations);
        // Copy relations from loaded instances to original instances at top-level
        for (const instance of instances) {
            const loaded = loadedMap.get(instance.id);
            if (!loaded)
                continue;
            for (const name of names) {
                if (loaded[name] !== undefined) {
                    instance[name] = loaded[name];
                    try {
                        const holder = instance.__relations || {};
                        if (!instance.__relations) {
                            Object.defineProperty(instance, '__relations', { value: holder, enumerable: false, configurable: true, writable: true });
                        }
                        holder[name] = true;
                    }
                    catch { /* no-op */ }
                }
            }
        }
    }
    static async loadMissing(instances, relations) {
        if (instances.length === 0)
            return;
        // Parse relations to get relation names
        const relationNames = this.parseRelationNames(relations);
        // Filter instances that don't have the relations loaded
        const instancesToLoad = instances.filter(inst => {
            const rels = inst.__relations || {};
            return relationNames.some(name => !(name in rels));
        });
        if (instancesToLoad.length === 0)
            return;
        await this.load(instancesToLoad, relations);
    }
    static async loadCount(instances, relations) {
        if (instances.length === 0)
            return;
        const model = instances[0].constructor;
        const qb = model.query();
        // Apply the relations to the query builder with count
        qb.withCount(relations);
        // Load the relations by calling get() on a query that matches the instances
        const ids = instances.map(inst => inst.id).filter(id => id !== null && id !== undefined);
        if (ids.length === 0)
            return;
        const loadedInstances = await model.query().withCount(relations).whereIn('id', ids).get();
        // Create a map of loaded instances by ID
        const loadedMap = new Map(loadedInstances.map(inst => [inst.id, inst]));
        // Determine relation names to copy count properties
        const relationNames = this.parseRelationNames(relations);
        // Copy count properties from loaded instances to original instances
        for (const instance of instances) {
            const loaded = loadedMap.get(instance.id);
            if (!loaded)
                continue;
            for (const name of relationNames) {
                const countProp = `${name}_count`;
                if (loaded[countProp] !== undefined) {
                    instance[countProp] = loaded[countProp];
                }
            }
        }
    }
    static parseRelationNames(relations) {
        if (typeof relations === 'string') {
            const base = relations.split(':')[0];
            return [base.split('.')[0]];
        }
        else if (Array.isArray(relations)) {
            return relations.map(r => r.split(':')[0]).map(n => n.split('.')[0]);
        }
        else if (relations && typeof relations === 'object') {
            return Object.keys(relations).map(n => n.split('.')[0]);
        }
        return [];
    }
    // Parse full relation names including nested paths (e.g., 'business.owner' stays as 'business.owner')
    static parseFullRelationNames(relations) {
        if (typeof relations === 'string') {
            return [relations.split(':')[0]];
        }
        else if (Array.isArray(relations)) {
            return relations.map(r => r.split(':')[0]);
        }
        else if (relations && typeof relations === 'object') {
            const result = [];
            for (const key of Object.keys(relations)) {
                result.push(key);
                const value = relations[key];
                // If the value is an array of nested relations, include them
                if (Array.isArray(value)) {
                    value.forEach(nested => {
                        result.push(`${key}.${nested}`);
                    });
                }
            }
            return result;
        }
        return [];
    }
}
Eloquent.hidden = [];
Eloquent.with = [];
Eloquent.connection = null;
Eloquent.morphMap = {};
Eloquent.automaticallyEagerLoadRelationshipsEnabled = false;
// Debug logging
Eloquent.debugEnabled = false;
Eloquent.debugLogger = (message, data) => {
    console.log(`[Eloquent Debug] ${message}`, data || '');
};
export default Eloquent;
export { QueryBuilder, Collection };
