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
    // Removed write operations (insert, insertGetId, update, delete) to keep ORM read-only
    async aggregate(functionName, column) {
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
    whereHas(relation, callback) {
        const exists = this.buildHasSubquery(relation, callback);
        this.whereRaw(`EXISTS (${exists.sql})`, exists.params);
        return this;
    }
    orWhereHas(relation, callback) {
        const exists = this.buildHasSubquery(relation, callback);
        this.orWhereRaw(`EXISTS (${exists.sql})`, exists.params);
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
    whereHasMorph(relation, modelType, callback) {
        const cfg = Eloquent.getRelationConfig(this.model, relation);
        if (!cfg || (cfg.type !== 'morphMany' && cfg.type !== 'morphOne')) {
            throw new Error(`Relation '${relation}' is not a morph relationship`);
        }
        const typeValue = typeof modelType === 'string' ? modelType : Eloquent.getMorphTypeForModel(modelType);
        const exists = this.buildHasSubquery(relation, callback);
        // Modify the subquery to filter by morph type
        const typeColumn = cfg.typeColumn || `${cfg.morphName}_type`;
        const modifiedSql = exists.sql.replace(`FROM ${cfg.model.name.toLowerCase()}s`, `FROM ${cfg.model.name.toLowerCase()}s WHERE ${cfg.model.name.toLowerCase()}s.${typeColumn} = ?`);
        this.whereRaw(`EXISTS (${modifiedSql})`, [typeValue, ...exists.params]);
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
    has(relation) {
        return this.whereHas(relation);
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
            return { sql: 'SELECT 1 WHERE 0=1', params: [] };
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
        for (const relation of relations) {
            const parts = relation.split('.');
            const relationKey = parts[0];
            const fullPath = prefix ? `${prefix}.${relationKey}` : relationKey;
            const cfg = Eloquent.getRelationConfig(currentModel, relationKey);
            await this.loadSingleRelation(instances, relationKey, currentModel, fullPath);
            if (parts.length > 1) {
                const subRelations = [parts.slice(1).join('.')];
                const relValues = instances
                    .map(inst => inst.__relations && inst.__relations[relationKey])
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
                    await this.loadRelations(list, subRelations, cfg.model, fullPath);
                }
            }
        }
    }
    async loadSingleRelation(instances, relationName, model, fullPath) {
        const config = Eloquent.getRelationConfig(model, relationName);
        if (!config)
            return;
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
        if (!Eloquent.connection)
            throw new Error('Database connection not initialized');
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
    async get() {
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
        // Link instances back to the collection so autoloading can scope to the entire set
        for (const inst of instances) {
            try {
                Object.defineProperty(inst, '__collection', {
                    value: collection,
                    enumerable: false,
                    configurable: true,
                    writable: true
                });
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
        // Get all possible relation names from the model
        const proto = instance.constructor.prototype;
        for (const key of Object.getOwnPropertyNames(proto)) {
            const config = Eloquent.getRelationConfig(instance.constructor, key);
            if (config) {
                relationConfigs.set(key, config);
            }
        }
        return new Proxy(instance, {
            get: (target, prop) => {
                // If it's a relationship and not loaded, check for auto-loading
                if (relationConfigs.has(prop) && !(prop in target) && this.shouldAutoLoad(target, prop)) {
                    this.autoLoadRelation(target, prop);
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
        if (collection && collection.isRelationshipAutoloadingEnabled()) {
            // Load for the entire collection
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
        const staticMap = model.relations && model.relations[relationName];
        if (staticMap)
            return staticMap;
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
            return ModelClass.query().where(ownerKey, this[foreignKey]);
        }
        else {
            return related.query().where(ownerKey, this[foreignKey]);
        }
    }
    hasMany(related, foreignKey, localKey = 'id') {
        if (typeof related === 'string') {
            // Resolve model from morph map
            const ModelClass = Eloquent.getModelForMorphType(related);
            if (!ModelClass) {
                throw new Error(`Model '${related}' not found in morph map`);
            }
            return ModelClass.query().where(foreignKey, this[localKey]);
        }
        else {
            return related.query().where(foreignKey, this[localKey]);
        }
    }
    hasOne(related, foreignKey, localKey = 'id') {
        if (typeof related === 'string') {
            // Resolve model from morph map
            const ModelClass = Eloquent.getModelForMorphType(related);
            if (!ModelClass) {
                throw new Error(`Model '${related}' not found in morph map`);
            }
            return ModelClass.query().where(foreignKey, this[localKey]);
        }
        else {
            return related.query().where(foreignKey, this[localKey]);
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
        const tCol = typeColumn || `${name}_type`;
        const iCol = idColumn || `${name}_id`;
        const morphTypes = Eloquent.getPossibleMorphTypesForModel(this.constructor);
        if (typeof related === 'string') {
            // Resolve model from morph map
            const ModelClass = Eloquent.getModelForMorphType(related);
            if (!ModelClass) {
                throw new Error(`Model '${related}' not found in morph map`);
            }
            return ModelClass.query().whereIn(tCol, morphTypes).where(iCol, this[localKey]);
        }
        else {
            return related.query().whereIn(tCol, morphTypes).where(iCol, this[localKey]);
        }
    }
    morphOneOfMany(related, name, column = 'created_at', aggregate = 'max', typeColumn, idColumn, localKey = 'id') {
        const tCol = typeColumn || `${name}_type`;
        const iCol = idColumn || `${name}_id`;
        const morphTypes = Eloquent.getPossibleMorphTypesForModel(this.constructor);
        if (typeof related === 'string') {
            // Resolve model from morph map
            const ModelClass = Eloquent.getModelForMorphType(related);
            if (!ModelClass) {
                throw new Error(`Model '${related}' not found in morph map`);
            }
            return ModelClass.query().whereIn(tCol, morphTypes).where(iCol, this[localKey]).ofMany(column, aggregate);
        }
        else {
            return related.query().whereIn(tCol, morphTypes).where(iCol, this[localKey]).ofMany(column, aggregate);
        }
    }
    latestMorphOne(related, name, column = 'created_at', typeColumn, idColumn, localKey = 'id') {
        return this.morphOneOfMany(related, name, column, 'max', typeColumn, idColumn, localKey);
    }
    oldestMorphOne(related, name, column = 'created_at', typeColumn, idColumn, localKey = 'id') {
        return this.morphOneOfMany(related, name, column, 'min', typeColumn, idColumn, localKey);
    }
    morphMany(related, name, typeColumn, idColumn, localKey = 'id') {
        const tCol = typeColumn || `${name}_type`;
        const iCol = idColumn || `${name}_id`;
        const morphTypes = Eloquent.getPossibleMorphTypesForModel(this.constructor);
        if (typeof related === 'string') {
            // If related is a table name, create a generic query
            const tableName = related;
            return new QueryBuilder({}).table(tableName).whereIn(tCol, morphTypes).where(iCol, this[localKey]);
        }
        else {
            // Normal case with model class
            return related.query().whereIn(tCol, morphTypes).where(iCol, this[localKey]);
        }
    }
    morphTo(name, typeColumn, idColumn) {
        const tCol = typeColumn || `${name}_type`;
        const iCol = idColumn || `${name}_id`;
        const typeValue = this[tCol];
        const idValue = this[iCol];
        const ModelCtor = Eloquent.getModelForMorphType(typeValue);
        if (!ModelCtor) {
            // Return a query builder that will never match anything
            return new QueryBuilder({}).whereRaw('0=1');
        }
        return ModelCtor.query().where('id', idValue);
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
        const fk1 = firstKey || `${through.name.toLowerCase()}_id`;
        const fk2 = secondKey || `${related.name.toLowerCase()}_id`;
        const throughTable = through.table || through.name.toLowerCase() + 's';
        const relatedTable = related.table || related.name.toLowerCase() + 's';
        return related.query().join(throughTable, `${relatedTable}.${fk2}`, '=', `${throughTable}.${secondLocalKey}`).where(`${throughTable}.${fk1}`, this[localKey]);
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
        const fk1 = firstKey || `${ResolvedThrough.name.toLowerCase()}_id`;
        const fk2 = secondKey || `${ResolvedRelated.name.toLowerCase()}_id`;
        const throughTable = ResolvedThrough.table || ResolvedThrough.name.toLowerCase() + 's';
        const relatedTable = ResolvedRelated.table || ResolvedRelated.name.toLowerCase() + 's';
        if (typeof related === 'string') {
            return ResolvedRelated.query().join(throughTable, `${relatedTable}.${fk2}`, '=', `${throughTable}.${secondLocalKey}`).where(`${throughTable}.${fk1}`, this[localKey]);
        }
        else {
            return ResolvedRelated.query().join(throughTable, `${relatedTable}.${fk2}`, '=', `${throughTable}.${secondLocalKey}`).where(`${throughTable}.${fk1}`, this[localKey]);
        }
    }
    belongsToMany(related, table, foreignPivotKey, relatedPivotKey, parentKey = 'id', relatedKey = 'id') {
        if (typeof related === 'string') {
            // Resolve model from morph map
            const ModelClass = Eloquent.getModelForMorphType(related);
            if (!ModelClass) {
                throw new Error(`Model '${related}' not found in morph map`);
            }
            const pivotTable = table || [this.constructor.name.toLowerCase(), ModelClass.name.toLowerCase()].sort().join('_');
            const fpk = foreignPivotKey || `${this.constructor.name.toLowerCase()}_id`;
            const rpk = relatedPivotKey || `${ModelClass.name.toLowerCase()}_id`;
            const relatedTable = ModelClass.table || ModelClass.name.toLowerCase() + 's';
            const qb = ModelClass.query().join(pivotTable, `${relatedTable}.${relatedKey}`, '=', `${pivotTable}.${rpk}`).where(`${pivotTable}.${fpk}`, this[parentKey]);
            // Add pivot configuration for withPivot support
            qb.pivotConfig = { table: pivotTable, alias: 'pivot', columns: new Set() };
            return qb;
        }
        else {
            const pivotTable = table || [this.constructor.name.toLowerCase(), related.name.toLowerCase()].sort().join('_');
            const fpk = foreignPivotKey || `${this.constructor.name.toLowerCase()}_id`;
            const rpk = relatedPivotKey || `${related.name.toLowerCase()}_id`;
            const relatedTable = related.table || related.name.toLowerCase() + 's';
            const qb = related.query().join(pivotTable, `${relatedTable}.${relatedKey}`, '=', `${pivotTable}.${rpk}`).where(`${pivotTable}.${fpk}`, this[parentKey]);
            // Add pivot configuration for withPivot support
            qb.pivotConfig = { table: pivotTable, alias: 'pivot', columns: new Set() };
            return qb;
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
        const targets = Array.isArray(collection) && collection.length ? collection : [this];
        const model = this.constructor;
        // Load only missing relations for the entire set
        await model.loadMissing(targets, relations);
        // Return the loaded relation value(s) for this instance for convenience
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
