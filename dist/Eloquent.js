class QueryBuilder {
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
    // Removed write operations (insert, insertGetId, update, delete) to keep ORM read-only
    async aggregate(functionName, column) {
        if (!Eloquent.connection)
            throw new Error('Database connection not initialized');
        const table = this.tableName || this.model.table || this.model.name.toLowerCase() + 's';
        let sql = `SELECT ${functionName}(${column}) as aggregate FROM ${table}`;
        const allConditions = this.conditions ? JSON.parse(JSON.stringify(this.conditions)) : [];
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
        this.ensureReadOnlySql(sql, 'aggregate');
        const [rows] = await Eloquent.connection.query(sql, whereClause.params);
        return rows[0].aggregate;
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
        const RelatedModel = cfg.model;
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
        if (typeof relations === 'string') {
            this.withRelations.push(relations);
            if (callback)
                this.withCallbacks[relations] = callback;
        }
        else if (Array.isArray(relations)) {
            for (const name of relations) {
                this.withRelations.push(name);
            }
        }
        else if (relations && typeof relations === 'object') {
            for (const [name, cb] of Object.entries(relations)) {
                this.withRelations.push(name);
                if (cb)
                    this.withCallbacks[name] = cb;
            }
        }
        return this;
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
    async loadRelations(instances, relations, model, prefix) {
        if (!relations || relations.length === 0)
            return;
        const currentModel = model || this.model;
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
            const RelatedModel = config.model;
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
            const map = new Map(relatedInstances.map((rel) => [rel[ownerKey], rel]));
            for (const inst of instances) {
                const target = map.get(inst[foreignKey]) || null;
                if (!inst.__relations)
                    Object.defineProperty(inst, '__relations', { value: {}, writable: true });
                inst.__relations[relationName] = target;
            }
        }
        else if (type === 'hasMany') {
            const RelatedModel = config.model;
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
            const map = new Map();
            for (const rel of relatedInstances) {
                const key = rel[foreignKey];
                if (!map.has(key))
                    map.set(key, []);
                map.get(key).push(rel);
            }
            for (const inst of instances) {
                if (!inst.__relations)
                    Object.defineProperty(inst, '__relations', { value: {}, writable: true });
                inst.__relations[relationName] = map.get(inst[localKey]) || [];
            }
        }
        else if (type === 'hasOne') {
            const RelatedModel = config.model;
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
            const map = new Map();
            for (const rel of relatedInstances) {
                const key = rel[foreignKey];
                map.set(key, rel);
            }
            for (const inst of instances) {
                if (!inst.__relations)
                    Object.defineProperty(inst, '__relations', { value: {}, writable: true });
                inst.__relations[relationName] = map.get(inst[localKey]) || null;
            }
        }
        else if (type === 'morphOne') {
            const RelatedModel = config.model;
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
            const map = new Map();
            for (const rel of relatedInstances) {
                const key = rel[idColumn];
                map.set(key, rel);
            }
            for (const inst of instances) {
                if (!inst.__relations)
                    Object.defineProperty(inst, '__relations', { value: {}, writable: true });
                inst.__relations[relationName] = map.get(inst[localKey]) || null;
            }
        }
        else if (type === 'morphMany') {
            const RelatedModel = config.model;
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
            const map = new Map();
            for (const rel of relatedInstances) {
                const key = rel[idColumn];
                if (!map.has(key))
                    map.set(key, []);
                map.get(key).push(rel);
            }
            for (const inst of instances) {
                if (!inst.__relations)
                    Object.defineProperty(inst, '__relations', { value: {}, writable: true });
                inst.__relations[relationName] = map.get(inst[localKey]) || [];
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
                        if (!inst.__relations)
                            Object.defineProperty(inst, '__relations', { value: {}, writable: true });
                        inst.__relations[relationName] = null;
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
                const map = new Map(relatedInstances.map((rel) => [rel.id, rel]));
                for (const inst of list) {
                    if (!inst.__relations)
                        Object.defineProperty(inst, '__relations', { value: {}, writable: true });
                    inst.__relations[relationName] = map.get(inst[idColumn]) || null;
                }
            }
        }
        else if (type === 'belongsToMany') {
            const RelatedModel = config.model;
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
            const rows = await this.getInBatches(parentIds, async (chunk) => {
                const qb = RelatedModel.query()
                    .addSelect(`${relatedTable}.*`)
                    .addSelect(`${pivotTable}.${fpk} as __pivot_fk`)
                    .join(pivotTable, `${relatedTable}.${relatedKey}`, '=', `${pivotTable}.${rpk}`)
                    .whereIn(`${pivotTable}.${fpk}`, chunk);
                // Expose pivot columns if requested via child query builder
                const columns = this.pivotConfig?.columns ? Array.from(this.pivotConfig.columns) : [];
                if (columns.length > 0) {
                    qb.setPivotSource?.(pivotTable, this.pivotConfig?.alias || 'pivot');
                    for (const col of columns) {
                        qb.addSelect(`${pivotTable}.${col} AS ${qb.pivotConfig.alias}__${col}`);
                    }
                }
                if (cb)
                    cb(qb);
                return qb.get();
            });
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
                delete rel['__pivot_fk'];
                arr.push(rel);
            }
            for (const inst of instances) {
                if (!inst.__relations)
                    Object.defineProperty(inst, '__relations', { value: {}, writable: true });
                inst.__relations[relationName] = map.get(inst[parentKey]) || [];
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
    async get() {
        if (!Eloquent.connection)
            throw new Error('Database connection not initialized');
        const hasUnions = this.unions.length > 0;
        const main = this.buildSelectSql({ includeOrderLimit: !hasUnions });
        let sql = main.sql;
        let allParams = [...main.params];
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
            Object.assign(instance, data);
            return instance;
        });
        await this.loadRelations(instances, this.withRelations || []);
        return instances;
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
}
QueryBuilder.IN_CHUNK_SIZE = 1000;
QueryBuilder.FORBIDDEN_SQL = [
    'insert', 'update', 'delete', 'replace', 'create', 'drop', 'alter', 'truncate',
    'grant', 'revoke', 'load data', 'into outfile'
];
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
        const fake = Object.create(proto);
        fake.belongsTo = (related, foreignKey, ownerKey = 'id') => ({ __relation: { type: 'belongsTo', model: related, foreignKey, ownerKey } });
        fake.hasMany = (related, foreignKey, localKey = 'id') => ({ __relation: { type: 'hasMany', model: related, foreignKey, localKey } });
        fake.hasOne = (related, foreignKey, localKey = 'id') => ({ __relation: { type: 'hasOne', model: related, foreignKey, localKey } });
        fake.morphOne = (related, name, typeColumn, idColumn, localKey = 'id') => ({ __relation: { type: 'morphOne', model: related, morphName: name, typeColumn, idColumn, localKey } });
        fake.morphMany = (related, name, typeColumn, idColumn, localKey = 'id') => ({ __relation: { type: 'morphMany', model: related, morphName: name, typeColumn, idColumn, localKey } });
        fake.morphTo = (name, typeColumn, idColumn) => ({ __relation: { type: 'morphTo', morphName: name, typeColumn, idColumn } });
        fake.belongsToMany = (related, table, foreignPivotKey, relatedPivotKey, parentKey = 'id', relatedKey = 'id') => ({ __relation: { type: 'belongsToMany', model: related, table, foreignPivotKey, relatedPivotKey, parentKey, relatedKey } });
        const result = relationFn.call(fake);
        if (result && typeof result === 'object' && '__relation' in result) {
            return result.__relation;
        }
        return null;
    }
    belongsTo(related, foreignKey, ownerKey = 'id') {
        return related.query().where(ownerKey, this[foreignKey]);
    }
    hasMany(related, foreignKey, localKey = 'id') {
        return related.query().where(foreignKey, this[localKey]);
    }
    hasOne(related, foreignKey, localKey = 'id') {
        return related.query().where(foreignKey, this[localKey]);
    }
    hasOneOfMany(related, foreignKey, column = 'created_at', aggregate = 'max', localKey = 'id') {
        return related.query().where(foreignKey, this[localKey]).ofMany(column, aggregate);
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
        return related.query().whereIn(tCol, morphTypes).where(iCol, this[localKey]);
    }
    morphOneOfMany(related, name, column = 'created_at', aggregate = 'max', typeColumn, idColumn, localKey = 'id') {
        const tCol = typeColumn || `${name}_type`;
        const iCol = idColumn || `${name}_id`;
        const morphTypes = Eloquent.getPossibleMorphTypesForModel(this.constructor);
        return related.query().whereIn(tCol, morphTypes).where(iCol, this[localKey]).ofMany(column, aggregate);
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
        return related.query().whereIn(tCol, morphTypes).where(iCol, this[localKey]);
    }
    morphTo(name, typeColumn, idColumn) {
        const tCol = typeColumn || `${name}_type`;
        const iCol = idColumn || `${name}_id`;
        const typeValue = this[tCol];
        const idValue = this[iCol];
        const ModelCtor = Eloquent.getModelForMorphType(typeValue);
        if (!ModelCtor)
            return {
                first: async () => null,
                get: async () => []
            };
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
        // fallback: global class name
        const anyGlobal = globalThis;
        if (anyGlobal[type])
            return anyGlobal[type];
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
        const fk1 = firstKey || `${through.name.toLowerCase()}_id`;
        const fk2 = secondKey || `${related.name.toLowerCase()}_id`;
        const throughTable = through.table || through.name.toLowerCase() + 's';
        const relatedTable = related.table || related.name.toLowerCase() + 's';
        return related.query().join(throughTable, `${relatedTable}.${fk2}`, '=', `${throughTable}.${secondLocalKey}`).where(`${throughTable}.${fk1}`, this[localKey]);
    }
    belongsToMany(related, table, foreignPivotKey, relatedPivotKey, parentKey = 'id', relatedKey = 'id') {
        const pivotTable = table || [this.constructor.name.toLowerCase(), related.name.toLowerCase()].sort().join('_');
        const fpk = foreignPivotKey || `${this.constructor.name.toLowerCase()}_id`;
        const rpk = relatedPivotKey || `${related.name.toLowerCase()}_id`;
        const relatedTable = related.table || related.name.toLowerCase() + 's';
        return related.query().join(pivotTable, `${relatedTable}.${relatedKey}`, '=', `${pivotTable}.${rpk}`).where(`${pivotTable}.${fpk}`, this[parentKey]);
    }
    static getProperty(key) {
        return this[key];
    }
    through(relationship) {
        return new ThroughBuilder(this, relationship);
    }
    static query() {
        return new QueryBuilder(this);
    }
    toJSON() {
        const hidden = this.constructor.hidden || [];
        const out = {};
        for (const key of Object.keys(this)) {
            if (hidden.includes(key))
                continue;
            out[key] = this[key];
        }
        const rels = this.__relations;
        if (rels) {
            for (const [k, v] of Object.entries(rels)) {
                out[k] = v;
            }
        }
        return out;
    }
}
Eloquent.fillable = [];
Eloquent.hidden = [];
Eloquent.connection = null;
Eloquent.morphMap = {};
export default Eloquent;
