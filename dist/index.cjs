"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/relations/Relation.ts
var Relation;
var init_Relation = __esm({
  "src/relations/Relation.ts"() {
    "use strict";
    Relation = class {
      constructor(parent, related) {
        this.parent = parent;
        this.related = related;
        this.query = related.query();
        this.addConstraints();
      }
      // ============================================================================
      // Query Builder Delegation - Chainable Methods
      // ============================================================================
      /**
       * Add a where clause to the query
       */
      where(column, operatorOrValue, value) {
        this.query.where(column, operatorOrValue, value);
        return this;
      }
      /**
       * Add a where in clause to the query
       */
      whereIn(column, values) {
        this.query.whereIn(column, values);
        return this;
      }
      /**
       * Add a where not in clause to the query
       */
      whereNotIn(column, values) {
        this.query.whereNotIn(column, values);
        return this;
      }
      /**
       * Add a where null clause to the query
       */
      whereNull(column) {
        this.query.whereNull(column);
        return this;
      }
      /**
       * Add a where not null clause to the query
       */
      whereNotNull(column) {
        this.query.whereNotNull(column);
        return this;
      }
      /**
       * Add a raw where clause to the query
       */
      whereRaw(sql, bindings) {
        this.query.whereRaw(sql, bindings);
        return this;
      }
      /**
       * Add an order by clause to the query
       */
      orderBy(column, direction = "asc") {
        this.query.orderBy(column, direction);
        return this;
      }
      /**
       * Limit the number of results
       */
      limit(count) {
        this.query.limit(count);
        return this;
      }
      /**
       * Skip a number of results
       */
      offset(count) {
        this.query.offset(count);
        return this;
      }
      /**
       * Select specific columns
       */
      select(...columns) {
        this.query.select(...columns);
        return this;
      }
      // ============================================================================
      // Query Execution Methods
      // ============================================================================
      /**
       * Execute the query and get all results
       */
      async get() {
        return this.query.get();
      }
      /**
       * Execute the query and get the first result
       */
      async first() {
        return this.query.first();
      }
      /**
       * Get the count of related records
       */
      async count() {
        return this.query.count();
      }
      /**
       * Check if any related records exist
       */
      async exists() {
        return this.query.exists();
      }
      // ============================================================================
      // Utility Methods
      // ============================================================================
      /**
       * Get the underlying query builder
       */
      getQuery() {
        return this.query;
      }
      /**
       * Get the parent model instance
       */
      getParent() {
        return this.parent;
      }
      /**
       * Get the related model class
       */
      getRelated() {
        return this.related;
      }
    };
  }
});

// src/relations/HasMany.ts
var HasMany;
var init_HasMany = __esm({
  "src/relations/HasMany.ts"() {
    "use strict";
    init_Relation();
    HasMany = class extends Relation {
      constructor(parent, related, foreignKey, localKey = "id") {
        parent.__tempForeignKey = foreignKey;
        parent.__tempLocalKey = localKey;
        super(parent, related);
        this.type = "hasMany";
        this.foreignKey = foreignKey;
        this.localKey = localKey;
        delete parent.__tempForeignKey;
        delete parent.__tempLocalKey;
      }
      /**
       * Add the base constraints - filter by parent's local key
       */
      addConstraints() {
        const foreignKey = this.parent.__tempForeignKey || this.foreignKey;
        const localKey = this.parent.__tempLocalKey || this.localKey;
        const parentKey = this.parent[localKey];
        if (parentKey !== null && parentKey !== void 0) {
          this.query.where(foreignKey, parentKey);
        }
      }
      /**
       * Get the relationship configuration for eager loading
       */
      getConfig() {
        return {
          type: "hasMany",
          model: this.related,
          foreignKey: this.foreignKey,
          localKey: this.localKey
        };
      }
      /**
       * Get the results of the relationship
       */
      async getResults() {
        const parentKey = this.parent[this.localKey];
        if (parentKey === null || parentKey === void 0) {
          return [];
        }
        return this.get();
      }
      /**
       * Get all results as a collection
       */
      async get() {
        return super.get();
      }
    };
  }
});

// src/relations/HasOne.ts
var HasOne;
var init_HasOne = __esm({
  "src/relations/HasOne.ts"() {
    "use strict";
    init_Relation();
    HasOne = class extends Relation {
      constructor(parent, related, foreignKey, localKey = "id") {
        parent.__tempForeignKey = foreignKey;
        parent.__tempLocalKey = localKey;
        super(parent, related);
        this.type = "hasOne";
        this.foreignKey = foreignKey;
        this.localKey = localKey;
        delete parent.__tempForeignKey;
        delete parent.__tempLocalKey;
      }
      /**
       * Add the base constraints - filter by parent's local key
       */
      addConstraints() {
        const foreignKey = this.parent.__tempForeignKey || this.foreignKey;
        const localKey = this.parent.__tempLocalKey || this.localKey;
        const parentKey = this.parent[localKey];
        if (parentKey !== null && parentKey !== void 0) {
          this.query.where(foreignKey, parentKey);
        }
      }
      /**
       * Get the relationship configuration for eager loading
       */
      getConfig() {
        return {
          type: "hasOne",
          model: this.related,
          foreignKey: this.foreignKey,
          localKey: this.localKey
        };
      }
      /**
       * Get the results of the relationship (single record or null)
       */
      async getResults() {
        const parentKey = this.parent[this.localKey];
        if (parentKey === null || parentKey === void 0) {
          return null;
        }
        return this.first();
      }
    };
  }
});

// src/relations/BelongsTo.ts
var BelongsTo;
var init_BelongsTo = __esm({
  "src/relations/BelongsTo.ts"() {
    "use strict";
    init_Relation();
    BelongsTo = class extends Relation {
      constructor(parent, related, foreignKey, ownerKey = "id") {
        parent.__tempForeignKey = foreignKey;
        parent.__tempOwnerKey = ownerKey;
        super(parent, related);
        this.type = "belongsTo";
        this.foreignKey = foreignKey;
        this.ownerKey = ownerKey;
        delete parent.__tempForeignKey;
        delete parent.__tempOwnerKey;
      }
      /**
       * Add the base constraints - filter by the foreign key value
       */
      addConstraints() {
        const foreignKey = this.parent.__tempForeignKey || this.foreignKey;
        const ownerKey = this.parent.__tempOwnerKey || this.ownerKey;
        const foreignKeyValue = this.parent[foreignKey];
        if (foreignKeyValue !== null && foreignKeyValue !== void 0) {
          this.query.where(ownerKey, foreignKeyValue);
        }
      }
      /**
       * Get the relationship configuration for eager loading
       */
      getConfig() {
        return {
          type: "belongsTo",
          model: this.related,
          foreignKey: this.foreignKey,
          ownerKey: this.ownerKey
        };
      }
      /**
       * Get the results of the relationship (single record or null)
       */
      async getResults() {
        const foreignKeyValue = this.parent[this.foreignKey];
        if (foreignKeyValue === null || foreignKeyValue === void 0) {
          return null;
        }
        return this.first();
      }
    };
  }
});

// src/relations/BelongsToMany.ts
var BelongsToMany;
var init_BelongsToMany = __esm({
  "src/relations/BelongsToMany.ts"() {
    "use strict";
    init_Relation();
    BelongsToMany = class extends Relation {
      constructor(parent, related, table, foreignPivotKey, relatedPivotKey, parentKey = "id", relatedKey = "id") {
        parent.__tempTable = table;
        parent.__tempForeignPivotKey = foreignPivotKey;
        parent.__tempRelatedPivotKey = relatedPivotKey;
        parent.__tempParentKey = parentKey;
        parent.__tempRelatedKey = relatedKey;
        super(parent, related);
        this.type = "belongsToMany";
        this.pivotColumns = [];
        this.table = table;
        this.foreignPivotKey = foreignPivotKey;
        this.relatedPivotKey = relatedPivotKey;
        this.parentKey = parentKey;
        this.relatedKey = relatedKey;
        delete parent.__tempTable;
        delete parent.__tempForeignPivotKey;
        delete parent.__tempRelatedPivotKey;
        delete parent.__tempParentKey;
        delete parent.__tempRelatedKey;
      }
      /**
       * Add the base constraints - join through pivot table
       */
      addConstraints() {
        const parentKey = this.parent.__tempParentKey || this.parentKey || "id";
        const parentKeyValue = this.parent[parentKey];
        if (parentKeyValue === null || parentKeyValue === void 0) {
          return;
        }
        const pivotTable = this.getPivotTable();
        const relatedTable = this.getRelatedTable();
        const fpk = this.getForeignPivotKey();
        const rpk = this.getRelatedPivotKey();
        const relatedKey = this.parent.__tempRelatedKey || this.relatedKey || "id";
        this.query.join(pivotTable, `${relatedTable}.${relatedKey}`, "=", `${pivotTable}.${rpk}`).where(`${pivotTable}.${fpk}`, parentKeyValue);
      }
      /**
       * Get the relationship configuration for eager loading
       */
      getConfig() {
        return {
          type: "belongsToMany",
          model: this.related,
          table: this.getPivotTable(),
          foreignPivotKey: this.getForeignPivotKey(),
          relatedPivotKey: this.getRelatedPivotKey(),
          parentKey: this.parentKey,
          relatedKey: this.relatedKey
        };
      }
      /**
       * Get the results of the relationship
       */
      async getResults() {
        const parentKeyValue = this.parent[this.parentKey];
        if (parentKeyValue === null || parentKeyValue === void 0) {
          return [];
        }
        return this.get();
      }
      /**
       * Specify which pivot columns to include
       */
      withPivot(...columns) {
        this.pivotColumns.push(...columns);
        const pivotTable = this.getPivotTable();
        for (const col of columns) {
          this.query.addSelect(`${pivotTable}.${col} as pivot_${col}`);
        }
        return this;
      }
      /**
       * Get the pivot table name
       */
      getPivotTable() {
        const table = this.parent.__tempTable || this.table;
        if (table) return table;
        const parentName = this.parent.constructor.name.toLowerCase();
        const relatedName = this.related.name.toLowerCase();
        return [parentName, relatedName].sort().join("_");
      }
      /**
       * Get the related model's table name
       */
      getRelatedTable() {
        return this.related.table || this.related.name.toLowerCase() + "s";
      }
      /**
       * Get the foreign pivot key
       */
      getForeignPivotKey() {
        const fpk = this.parent.__tempForeignPivotKey || this.foreignPivotKey;
        return fpk || `${this.parent.constructor.name.toLowerCase()}_id`;
      }
      /**
       * Get the related pivot key
       */
      getRelatedPivotKey() {
        const rpk = this.parent.__tempRelatedPivotKey || this.relatedPivotKey;
        return rpk || `${this.related.name.toLowerCase()}_id`;
      }
    };
  }
});

// src/relations/MorphMany.ts
var MorphMany;
var init_MorphMany = __esm({
  "src/relations/MorphMany.ts"() {
    "use strict";
    init_Relation();
    MorphMany = class extends Relation {
      constructor(parent, related, morphName, typeColumn, idColumn, localKey = "id") {
        const tCol = typeColumn || `${morphName}_type`;
        const iCol = idColumn || `${morphName}_id`;
        parent.__tempTypeColumn = tCol;
        parent.__tempIdColumn = iCol;
        super(parent, related);
        this.morphName = morphName;
        this.localKey = localKey;
        this.type = "morphMany";
        this.typeColumn = tCol;
        this.idColumn = iCol;
        delete parent.__tempTypeColumn;
        delete parent.__tempIdColumn;
      }
      /**
       * Add the base constraints - filter by morph type and id
       */
      addConstraints() {
        const typeColumn = this.parent.__tempTypeColumn || this.typeColumn;
        const idColumn = this.parent.__tempIdColumn || this.idColumn;
        const parentKey = this.parent[this.localKey];
        const morphTypes = this.getMorphTypes();
        if (parentKey !== null && parentKey !== void 0) {
          this.query.whereIn(typeColumn, morphTypes);
          this.query.where(idColumn, parentKey);
        }
      }
      /**
       * Get the relationship configuration for eager loading
       */
      getConfig() {
        return {
          type: "morphMany",
          model: this.related,
          morphName: this.morphName,
          typeColumn: this.typeColumn,
          idColumn: this.idColumn,
          localKey: this.localKey
        };
      }
      /**
       * Get the results of the relationship
       */
      async getResults() {
        const parentKey = this.parent[this.localKey];
        if (parentKey === null || parentKey === void 0) {
          return [];
        }
        return this.get();
      }
      /**
       * Get possible morph type values for the parent model
       */
      getMorphTypes() {
        const parentClass = this.parent.constructor;
        const types = /* @__PURE__ */ new Set();
        const explicitClass = parentClass.morphClass;
        if (explicitClass) types.add(explicitClass);
        const explicitTypes = parentClass.morphTypes;
        if (explicitTypes && Array.isArray(explicitTypes)) {
          for (const t of explicitTypes) if (t) types.add(t);
        }
        types.add(parentClass.name);
        return Array.from(types);
      }
    };
  }
});

// src/relations/MorphOne.ts
var MorphOneBase, MorphOne;
var init_MorphOne = __esm({
  "src/relations/MorphOne.ts"() {
    "use strict";
    init_Relation();
    MorphOneBase = class extends Relation {
      constructor(parent, related, morphName, typeColumn, idColumn, localKey = "id") {
        const tCol = typeColumn || `${morphName}_type`;
        const iCol = idColumn || `${morphName}_id`;
        parent.__tempTypeColumn = tCol;
        parent.__tempIdColumn = iCol;
        super(parent, related);
        this.morphName = morphName;
        this.localKey = localKey;
        this.typeColumn = tCol;
        this.idColumn = iCol;
        delete parent.__tempTypeColumn;
        delete parent.__tempIdColumn;
      }
      /**
       * Add the base constraints - filter by morph type and id
       */
      addConstraints() {
        const typeColumn = this.parent.__tempTypeColumn || this.typeColumn;
        const idColumn = this.parent.__tempIdColumn || this.idColumn;
        const parentKey = this.parent[this.localKey];
        const morphTypes = this.getMorphTypes();
        if (parentKey !== null && parentKey !== void 0) {
          this.query.whereIn(typeColumn, morphTypes);
          this.query.where(idColumn, parentKey);
        }
      }
      /**
       * Get the related model's table name
       */
      getRelatedTable() {
        return this.related.table || this.related.name.toLowerCase() + "s";
      }
      /**
       * Get possible morph type values for the parent model
       */
      getMorphTypes() {
        const parentClass = this.parent.constructor;
        const types = /* @__PURE__ */ new Set();
        const explicitClass = parentClass.morphClass;
        if (explicitClass) types.add(explicitClass);
        const explicitTypes = parentClass.morphTypes;
        if (explicitTypes && Array.isArray(explicitTypes)) {
          for (const t of explicitTypes) if (t) types.add(t);
        }
        types.add(parentClass.name);
        return Array.from(types);
      }
    };
    MorphOne = class extends MorphOneBase {
      constructor() {
        super(...arguments);
        this.type = "morphOne";
      }
      /**
       * Get the relationship configuration for eager loading
       */
      getConfig() {
        return {
          type: "morphOne",
          model: this.related,
          morphName: this.morphName,
          typeColumn: this.typeColumn,
          idColumn: this.idColumn,
          localKey: this.localKey
        };
      }
      /**
       * Get the results of the relationship (single record or null)
       */
      async getResults() {
        const parentKey = this.parent[this.localKey];
        if (parentKey === null || parentKey === void 0) {
          return null;
        }
        return this.first();
      }
    };
  }
});

// src/relations/MorphTo.ts
var MorphTo;
var init_MorphTo = __esm({
  "src/relations/MorphTo.ts"() {
    "use strict";
    init_Relation();
    MorphTo = class _MorphTo extends Relation {
      constructor(parent, morphName, typeColumn, idColumn) {
        const tCol = typeColumn || `${morphName}_type`;
        const iCol = idColumn || `${morphName}_id`;
        const typeValue = parent[tCol];
        const relatedModel = _MorphTo.resolveRelatedModel(typeValue);
        parent.__tempTypeColumn = tCol;
        parent.__tempIdColumn = iCol;
        super(parent, relatedModel || parent.constructor);
        this.morphName = morphName;
        this.type = "morphTo";
        this.typeColumn = tCol;
        this.idColumn = iCol;
        delete parent.__tempTypeColumn;
        delete parent.__tempIdColumn;
      }
      /**
       * Add the base constraints - filter by the id value
       */
      addConstraints() {
        const idColumn = this.parent.__tempIdColumn || this.idColumn;
        const idValue = this.parent[idColumn];
        if (idValue !== null && idValue !== void 0) {
          this.query.where("id", idValue);
        } else {
          this.query.whereRaw("0 = 1");
        }
      }
      /**
       * Get the relationship configuration for eager loading
       */
      getConfig() {
        return {
          type: "morphTo",
          model: this.related,
          morphName: this.morphName,
          typeColumn: this.typeColumn,
          idColumn: this.idColumn
        };
      }
      /**
       * Get the results of the relationship (single record or null)
       */
      async getResults() {
        const typeValue = this.parent[this.typeColumn];
        const idValue = this.parent[this.idColumn];
        if (!typeValue || idValue === null || idValue === void 0) {
          return null;
        }
        const relatedModel = _MorphTo.resolveRelatedModel(typeValue);
        if (!relatedModel) {
          return null;
        }
        return relatedModel.query().where("id", idValue).first();
      }
      /**
       * Resolve the related model class from a morph type string
       */
      static resolveRelatedModel(typeValue) {
        if (!typeValue) return null;
        try {
          const { Eloquent: Eloquent2 } = (init_Eloquent(), __toCommonJS(Eloquent_exports));
          return Eloquent2.getModelForMorphType(typeValue);
        } catch {
          return null;
        }
      }
    };
  }
});

// src/relations/MorphOneOfMany.ts
var MorphOneOfMany;
var init_MorphOneOfMany = __esm({
  "src/relations/MorphOneOfMany.ts"() {
    "use strict";
    init_MorphOne();
    MorphOneOfMany = class extends MorphOneBase {
      constructor(parent, related, morphName, column = "created_at", aggregate = "max", typeColumn, idColumn, localKey = "id") {
        super(parent, related, morphName, typeColumn, idColumn, localKey);
        this.column = column;
        this.aggregate = aggregate;
        this.type = "morphOneOfMany";
      }
      /**
       * Add the base constraints - filter by morph type/id and aggregate
       */
      addConstraints() {
        super.addConstraints();
        const parentKey = this.parent[this.localKey];
        if (parentKey !== null && parentKey !== void 0) {
          const relatedTable = this.getRelatedTable();
          const aggFn = this.aggregate === "max" ? "MAX" : "MIN";
          this.query.whereRaw(`${relatedTable}.${this.column} = (
        SELECT ${aggFn}(sub.${this.column}) FROM ${relatedTable} sub
        WHERE sub.${this.typeColumn} = ${relatedTable}.${this.typeColumn}
        AND sub.${this.idColumn} = ${relatedTable}.${this.idColumn}
      )`);
        }
      }
      /**
       * Get the relationship configuration for eager loading
       */
      getConfig() {
        return {
          type: "morphOneOfMany",
          model: this.related,
          morphName: this.morphName,
          typeColumn: this.typeColumn,
          idColumn: this.idColumn,
          localKey: this.localKey,
          column: this.column,
          aggregate: this.aggregate
        };
      }
      /**
       * Get the results of the relationship (single record or null)
       */
      async getResults() {
        const parentKey = this.parent[this.localKey];
        if (parentKey === null || parentKey === void 0) {
          return null;
        }
        return this.first();
      }
    };
  }
});

// src/relations/HasManyThrough.ts
var ThroughRelation, HasManyThrough, HasOneThrough;
var init_HasManyThrough = __esm({
  "src/relations/HasManyThrough.ts"() {
    "use strict";
    init_Relation();
    ThroughRelation = class extends Relation {
      constructor(parent, related, through, firstKey, secondKey, localKey = "id", secondLocalKey = "id") {
        super(parent, related);
        this.through = through;
        this.firstKey = firstKey;
        this.secondKey = secondKey;
        this.localKey = localKey;
        this.secondLocalKey = secondLocalKey;
      }
      /**
       * Add the base constraints - join through intermediate table
       */
      addConstraints() {
        const parentKey = this.parent[this.localKey];
        if (parentKey === null || parentKey === void 0) {
          return;
        }
        const relatedTable = this.getRelatedTable();
        const throughTable = this.getThroughTable();
        const fk1 = this.getFirstKey();
        const fk2 = this.getSecondKey();
        this.query.join(throughTable, `${relatedTable}.${fk2}`, "=", `${throughTable}.${this.secondLocalKey}`).where(`${throughTable}.${fk1}`, parentKey);
      }
      /**
       * Get the related model's table name
       */
      getRelatedTable() {
        return this.related.table || this.related.name.toLowerCase() + "s";
      }
      /**
       * Get the through model's table name
       */
      getThroughTable() {
        return this.through.table || this.through.name.toLowerCase() + "s";
      }
      /**
       * Get the first key (on the through table, pointing to parent)
       */
      getFirstKey() {
        return this.firstKey || `${this.parent.constructor.name.toLowerCase()}_id`;
      }
      /**
       * Get the second key (on the related table, pointing to through)
       */
      getSecondKey() {
        return this.secondKey || `${this.through.name.toLowerCase()}_id`;
      }
    };
    HasManyThrough = class extends ThroughRelation {
      constructor() {
        super(...arguments);
        this.type = "hasManyThrough";
      }
      /**
       * Get the relationship configuration for eager loading
       */
      getConfig() {
        return {
          type: "hasManyThrough",
          model: this.related,
          through: this.through,
          firstKey: this.getFirstKey(),
          secondKey: this.getSecondKey(),
          localKey: this.localKey,
          secondLocalKey: this.secondLocalKey
        };
      }
      /**
       * Get the results of the relationship
       */
      async getResults() {
        const parentKey = this.parent[this.localKey];
        if (parentKey === null || parentKey === void 0) {
          return [];
        }
        return this.get();
      }
    };
    HasOneThrough = class extends ThroughRelation {
      constructor() {
        super(...arguments);
        this.type = "hasOneThrough";
      }
      /**
       * Get the relationship configuration for eager loading
       */
      getConfig() {
        return {
          type: "hasOneThrough",
          model: this.related,
          through: this.through,
          firstKey: this.getFirstKey(),
          secondKey: this.getSecondKey(),
          localKey: this.localKey,
          secondLocalKey: this.secondLocalKey
        };
      }
      /**
       * Get the results of the relationship (single record or null)
       */
      async getResults() {
        const parentKey = this.parent[this.localKey];
        if (parentKey === null || parentKey === void 0) {
          return null;
        }
        return this.first();
      }
    };
  }
});

// src/relations/index.ts
var init_relations = __esm({
  "src/relations/index.ts"() {
    "use strict";
    init_Relation();
    init_HasMany();
    init_HasOne();
    init_BelongsTo();
    init_BelongsToMany();
    init_MorphMany();
    init_MorphOne();
    init_MorphTo();
    init_MorphOneOfMany();
    init_HasManyThrough();
  }
});

// src/Eloquent.ts
var Eloquent_exports = {};
__export(Eloquent_exports, {
  Collection: () => Collection,
  QueryBuilder: () => QueryBuilder,
  default: () => Eloquent_default
});
var import_node_async_hooks, import_promise, _QueryBuilder, QueryBuilder, Collection, COLLECTION_ID_COUNTER, ThroughBuilder, _Eloquent, Eloquent, Eloquent_default;
var init_Eloquent = __esm({
  "src/Eloquent.ts"() {
    "use strict";
    import_node_async_hooks = require("async_hooks");
    import_promise = require("mysql2/promise");
    init_relations();
    _QueryBuilder = class _QueryBuilder {
      constructor(model) {
        this.conditions = [];
        this.selectColumns = ["*"];
        this.isDistinct = false;
        this.joins = [];
        this.unions = [];
        this.orderByClauses = [];
        this.groupByColumns = [];
        this.havingConditions = [];
        this.trashedMode = "default";
        this.selectBindings = [];
        this.model = model;
      }
      debugLog(message, data) {
        if (Eloquent.debugEnabled) {
          Eloquent.debugLogger(message, data);
        }
      }
      resolveTableName(model = this.model, tableOverride) {
        return Eloquent.resolveTableName(model, tableOverride);
      }
      prefixTableWithDatabase(table) {
        return Eloquent.prefixTableWithDatabase(table);
      }
      prefixColumnWithDatabase(column, allowedTables) {
        return Eloquent.prefixColumnWithDatabase(column, allowedTables);
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
      orderBy(column, direction = "asc") {
        this.orderByClauses.push({ column, direction });
        return this;
      }
      orderByDesc(column) {
        return this.orderBy(column, "desc");
      }
      latest(column = "created_at") {
        return this.orderBy(column, "desc");
      }
      oldest(column = "created_at") {
        return this.orderBy(column, "asc");
      }
      inRandomOrder() {
        this.orderByClauses.push({ column: "RAND()", direction: "asc" });
        return this;
      }
      groupBy(...columns) {
        this.groupByColumns.push(...columns);
        return this;
      }
      having(columnOrCallback, operator, value) {
        if (typeof columnOrCallback === "function") {
          const subQuery = new _QueryBuilder(this.model);
          columnOrCallback(subQuery);
          if (subQuery.conditions.length > 0) {
            this.havingConditions.push({ operator: "AND", group: subQuery.conditions });
          }
        } else {
          const column = columnOrCallback;
          const op = operator || "=";
          const val = value;
          this.havingConditions.push({ operator: "AND", type: "basic", conditionOperator: op, column, value: val });
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
        this.joins.push({ type: "inner", table, first, operator, second });
        return this;
      }
      leftJoin(table, first, operator, second) {
        this.joins.push({ type: "left", table, first, operator, second });
        return this;
      }
      rightJoin(table, first, operator, second) {
        this.joins.push({ type: "right", table, first, operator, second });
        return this;
      }
      crossJoin(table) {
        this.joins.push({ type: "cross", table });
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
      async count(column = "*") {
        return this.aggregate("COUNT", column);
      }
      async max(column) {
        return this.aggregate("MAX", column);
      }
      async min(column) {
        return this.aggregate("MIN", column);
      }
      async avg(column) {
        return this.aggregate("AVG", column);
      }
      async sum(column) {
        return this.aggregate("SUM", column);
      }
      async exists() {
        const result = await this.count();
        return result > 0;
      }
      async doesntExist() {
        return !await this.exists();
      }
      async pluck(column, key) {
        const results = await this.get();
        if (key) {
          return results.reduce((acc, row) => {
            acc[row[key]] = row[column];
            return acc;
          }, {});
        } else {
          return results.map((row) => row[column]);
        }
      }
      async value(column) {
        const row = await this.first();
        return row ? row[column] : null;
      }
      async find(id) {
        return this.where("id", id).first();
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
        return typeof defaultValue === "function" ? defaultValue() : defaultValue;
      }
      // Removed write operations (insert, insertGetId, update, delete) to keep ORM read-only
      async aggregate(functionName, column) {
        var _a;
        if (this.model.usesSushi()) {
          return this.aggregateSushi(functionName, column);
        }
        const connection = await Eloquent.resolveConnection();
        const table = this.resolveTableName(this.model, this.tableName);
        let sql = `SELECT ${functionName}(${column}) as aggregate FROM ${table}`;
        const allConditions = this.conditions ? JSON.parse(JSON.stringify(this.conditions)) : [];
        const globalScopes = this.model.globalScopes;
        if (globalScopes) {
          for (const scope of globalScopes) {
            if (typeof scope === "function") {
              const scopeQuery = new _QueryBuilder(this.model);
              scope.call(this.model, scopeQuery);
              if (scopeQuery.conditions.length > 0) {
                allConditions.push({ operator: "AND", group: scopeQuery.conditions });
              }
            }
          }
        }
        const soft = this.model.softDeletes;
        if (soft) {
          if (this.trashedMode === "default") {
            allConditions.push({ operator: "AND", type: "null", column: `${table}.deleted_at` });
          } else if (this.trashedMode === "only") {
            allConditions.push({ operator: "AND", type: "not_null", column: `${table}.deleted_at` });
          }
        }
        const whereClause = allConditions.length > 0 ? this.buildWhereClause(allConditions) : { sql: "", params: [] };
        if (whereClause.sql) sql += ` WHERE ${whereClause.sql}`;
        this.debugLog("Executing aggregate query", { sql, params: whereClause.params, function: functionName, column });
        this.ensureReadOnlySql(sql, "aggregate");
        const [rows] = await connection.query(sql, whereClause.params);
        const result = ((_a = rows == null ? void 0 : rows[0]) == null ? void 0 : _a.aggregate) ?? 0;
        this.debugLog("Aggregate query completed", { function: functionName, column, result });
        return result;
      }
      where(columnOrCallback, operatorOrValue, value) {
        if (typeof columnOrCallback === "function") {
          const subQuery = new _QueryBuilder(this.model);
          columnOrCallback(subQuery);
          if (subQuery.conditions.length > 0) {
            this.conditions.push({ operator: "AND", group: subQuery.conditions });
          }
        } else {
          const column = columnOrCallback;
          let conditionOperator;
          let val;
          if (value !== void 0) {
            conditionOperator = operatorOrValue;
            val = value;
          } else {
            conditionOperator = "=";
            val = operatorOrValue;
          }
          this.conditions.push({ operator: "AND", type: "basic", conditionOperator, column, value: val });
        }
        return this;
      }
      orWhere(columnOrCallback, operatorOrValue, value) {
        if (typeof columnOrCallback === "function") {
          const subQuery = new _QueryBuilder(this.model);
          columnOrCallback(subQuery);
          this.conditions.push({ operator: "OR", group: subQuery.conditions });
        } else {
          const column = columnOrCallback;
          let conditionOperator;
          let val;
          if (value !== void 0) {
            conditionOperator = operatorOrValue;
            val = value;
          } else {
            conditionOperator = "=";
            val = operatorOrValue;
          }
          this.conditions.push({ operator: "OR", type: "basic", conditionOperator, column, value: val });
        }
        return this;
      }
      whereIn(column, values) {
        this.conditions.push({ operator: "AND", type: "in", column, value: values });
        return this;
      }
      whereNotIn(column, values) {
        this.conditions.push({ operator: "AND", type: "not_in", column, value: values });
        return this;
      }
      orWhereIn(column, values) {
        this.conditions.push({ operator: "OR", type: "in", column, value: values });
        return this;
      }
      orWhereNotIn(column, values) {
        this.conditions.push({ operator: "OR", type: "not_in", column, value: values });
        return this;
      }
      whereNull(column) {
        this.conditions.push({ operator: "AND", type: "null", column });
        return this;
      }
      whereNotNull(column) {
        this.conditions.push({ operator: "AND", type: "not_null", column });
        return this;
      }
      orWhereNull(column) {
        this.conditions.push({ operator: "OR", type: "null", column });
        return this;
      }
      orWhereNotNull(column) {
        this.conditions.push({ operator: "OR", type: "not_null", column });
        return this;
      }
      whereBetween(column, values) {
        this.conditions.push({ operator: "AND", type: "between", column, value: values });
        return this;
      }
      whereNotBetween(column, values) {
        this.conditions.push({ operator: "AND", type: "not_between", column, value: values });
        return this;
      }
      orWhereBetween(column, values) {
        this.conditions.push({ operator: "OR", type: "between", column, value: values });
        return this;
      }
      orWhereNotBetween(column, values) {
        this.conditions.push({ operator: "OR", type: "not_between", column, value: values });
        return this;
      }
      // Date-based where clauses
      whereDate(column, operatorOrValue, value) {
        if (value === void 0) {
          this.conditions.push({ operator: "AND", type: "raw", sql: `DATE(${column}) = ?`, bindings: [operatorOrValue] });
        } else {
          this.conditions.push({ operator: "AND", type: "raw", sql: `DATE(${column}) ${operatorOrValue} ?`, bindings: [value] });
        }
        return this;
      }
      whereMonth(column, operatorOrValue, value) {
        if (value === void 0) {
          this.conditions.push({ operator: "AND", type: "raw", sql: `MONTH(${column}) = ?`, bindings: [operatorOrValue] });
        } else {
          this.conditions.push({ operator: "AND", type: "raw", sql: `MONTH(${column}) ${operatorOrValue} ?`, bindings: [value] });
        }
        return this;
      }
      whereYear(column, operatorOrValue, value) {
        if (value === void 0) {
          this.conditions.push({ operator: "AND", type: "raw", sql: `YEAR(${column}) = ?`, bindings: [operatorOrValue] });
        } else {
          this.conditions.push({ operator: "AND", type: "raw", sql: `YEAR(${column}) ${operatorOrValue} ?`, bindings: [value] });
        }
        return this;
      }
      whereDay(column, operatorOrValue, value) {
        if (value === void 0) {
          this.conditions.push({ operator: "AND", type: "raw", sql: `DAY(${column}) = ?`, bindings: [operatorOrValue] });
        } else {
          this.conditions.push({ operator: "AND", type: "raw", sql: `DAY(${column}) ${operatorOrValue} ?`, bindings: [value] });
        }
        return this;
      }
      whereTime(column, operatorOrValue, value) {
        if (value === void 0) {
          this.conditions.push({ operator: "AND", type: "raw", sql: `TIME(${column}) = ?`, bindings: [operatorOrValue] });
        } else {
          this.conditions.push({ operator: "AND", type: "raw", sql: `TIME(${column}) ${operatorOrValue} ?`, bindings: [value] });
        }
        return this;
      }
      // whereNot - negate a condition or group
      whereNot(columnOrCallback, operatorOrValue, value) {
        if (typeof columnOrCallback === "function") {
          const subQuery = new _QueryBuilder(this.model);
          columnOrCallback(subQuery);
          if (subQuery.conditions.length > 0) {
            this.conditions.push({ operator: "AND", type: "raw", sql: "NOT", bindings: [] });
            this.conditions.push({ operator: "AND", group: subQuery.conditions });
          }
        } else {
          if (value === void 0) {
            return this.where(columnOrCallback, "!=", operatorOrValue);
          } else {
            const negatedOp = this.negateOperator(operatorOrValue);
            return this.where(columnOrCallback, negatedOp, value);
          }
        }
        return this;
      }
      negateOperator(op) {
        const negations = {
          "=": "!=",
          "!=": "=",
          "<>": "=",
          "<": ">=",
          "<=": ">",
          ">": "<=",
          ">=": "<",
          "LIKE": "NOT LIKE",
          "NOT LIKE": "LIKE",
          "IN": "NOT IN",
          "NOT IN": "IN"
        };
        return negations[op.toUpperCase()] || op;
      }
      // whereAny - match any of the given columns
      whereAny(columns, operator, value) {
        const conditions = columns.map((col) => `${col} ${operator} ?`).join(" OR ");
        const bindings = columns.map(() => value);
        this.conditions.push({ operator: "AND", type: "raw", sql: `(${conditions})`, bindings });
        return this;
      }
      // whereAll - match all of the given columns
      whereAll(columns, operator, value) {
        const conditions = columns.map((col) => `${col} ${operator} ?`).join(" AND ");
        const bindings = columns.map(() => value);
        this.conditions.push({ operator: "AND", type: "raw", sql: `(${conditions})`, bindings });
        return this;
      }
      // whereLike - case-sensitive LIKE
      whereLike(column, value) {
        return this.where(column, "LIKE", value);
      }
      // whereNotLike
      whereNotLike(column, value) {
        return this.where(column, "NOT LIKE", value);
      }
      // whereIntegerInRaw - for large arrays, uses raw SQL without bindings
      whereIntegerInRaw(column, values) {
        if (values.length === 0) {
          this.conditions.push({ operator: "AND", type: "raw", sql: "0 = 1", bindings: [] });
        } else {
          const list = values.map((v) => parseInt(String(v), 10)).join(", ");
          this.conditions.push({ operator: "AND", type: "raw", sql: `${column} IN (${list})`, bindings: [] });
        }
        return this;
      }
      whereIntegerNotInRaw(column, values) {
        if (values.length === 0) {
          return this;
        }
        const list = values.map((v) => parseInt(String(v), 10)).join(", ");
        this.conditions.push({ operator: "AND", type: "raw", sql: `${column} NOT IN (${list})`, bindings: [] });
        return this;
      }
      // reorder - clear existing orders and optionally set new one
      reorder(column, direction = "asc") {
        this.orderByClauses = [];
        if (column) {
          this.orderBy(column, direction);
        }
        return this;
      }
      selectRaw(sql, bindings) {
        this.ensureReadOnlySnippet(sql, "selectRaw");
        this.selectColumns.push(sql);
        if (bindings && bindings.length) this.selectBindings.push(...bindings);
        return this;
      }
      whereRaw(sql, bindings) {
        this.ensureReadOnlySnippet(sql, "whereRaw");
        this.conditions.push({ operator: "AND", type: "raw", sql, bindings: bindings || [] });
        return this;
      }
      orWhereRaw(sql, bindings) {
        this.ensureReadOnlySnippet(sql, "orWhereRaw");
        this.conditions.push({ operator: "OR", type: "raw", sql, bindings: bindings || [] });
        return this;
      }
      when(condition, callback, defaultCallback) {
        if (condition) {
          callback(this);
        } else if (defaultCallback) {
          defaultCallback(this);
        }
        return this;
      }
      unless(condition, callback, defaultCallback) {
        if (!condition) {
          callback(this);
        } else if (defaultCallback) {
          defaultCallback(this);
        }
        return this;
      }
      whereHas(relation, callback, operator, count) {
        if (operator !== void 0 && count !== void 0) {
          const countSubquery = this.buildCountSubquery(relation, callback);
          this.whereRaw(`(${countSubquery.sql}) ${operator} ?`, [...countSubquery.params, count]);
        } else {
          const exists = this.buildHasSubquery(relation, callback);
          this.whereRaw(`EXISTS (${exists.sql})`, exists.params);
        }
        return this;
      }
      orWhereHas(relation, callback, operator, count) {
        if (operator !== void 0 && count !== void 0) {
          const countSubquery = this.buildCountSubquery(relation, callback);
          this.orWhereRaw(`(${countSubquery.sql}) ${operator} ?`, [...countSubquery.params, count]);
        } else {
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
          const ids = model.map((m) => m.id).filter((id) => id !== null && id !== void 0);
          if (ids.length === 0) {
            this.whereRaw("0=1");
            return this;
          }
          return this.whereIn(this.getBelongsToForeignKey(relation), ids);
        } else {
          return this.where(this.getBelongsToForeignKey(relation), model.id);
        }
      }
      getBelongsToForeignKey(relation) {
        if (relation) {
          const cfg = Eloquent.getRelationConfig(this.model, relation);
          if (cfg && cfg.type === "belongsTo") {
            return cfg.foreignKey;
          }
          throw new Error(`Relation '${relation}' is not a belongsTo relationship`);
        } else {
          throw new Error("Relation name must be provided for whereBelongsTo when not inferring from model type");
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
        if (!cfg || cfg.type !== "morphTo") {
          throw new Error(`Relation '${relation}' is not a morphTo relationship`);
        }
        const typeColumn = cfg.typeColumn || `${cfg.morphName}_type`;
        const idColumn = cfg.idColumn || `${cfg.morphName}_id`;
        const typeValue = Eloquent.getMorphTypeForModel(model.constructor);
        return this.where(typeColumn, typeValue).where(idColumn, model.id);
      }
      has(relation, operator = ">=", count = 1) {
        if (operator === ">=" && count === 1) {
          return this.whereHas(relation);
        }
        return this.whereHas(relation, void 0, operator, count);
      }
      orHas(relation, operator = ">=", count = 1) {
        if (operator === ">=" && count === 1) {
          return this.orWhereHas(relation);
        }
        return this.orWhereHas(relation, void 0, operator, count);
      }
      withCount(relations) {
        const list = [];
        if (typeof relations === "string") {
          list.push({ name: relations });
        } else if (Array.isArray(relations)) {
          for (const name of relations) list.push({ name });
        } else if (relations && typeof relations === "object") {
          for (const [name, cb] of Object.entries(relations)) list.push({ name, cb });
        }
        for (const item of list) {
          const count = this.buildCountSubquery(item.name, item.cb);
          const alias = `${item.name.replace(/\./g, "_")}_count`;
          this.selectRaw(`(${count.sql}) as ${alias}`, count.params);
        }
        return this;
      }
      buildCountSubquery(relation, callback) {
        const exists = this.buildHasSubquery(relation, callback, true);
        const sql = exists.sql.replace(/^SELECT\s+1\s+/i, "SELECT COUNT(*) ");
        return { sql, params: exists.params };
      }
      buildHasSubquery(relationName, callback, isCount = false) {
        const cfg = Eloquent.getRelationConfig(this.model, relationName);
        if (!cfg) {
          throw new Error(`Relationship '${relationName}' does not exist on model ${this.model.name}`);
        }
        const parentTable = this.resolveTableName(this.model, this.tableName);
        const RelatedModel = typeof cfg.model === "string" ? Eloquent.getModelForMorphType(cfg.model) : cfg.model;
        const relatedTable = this.resolveTableName(RelatedModel);
        const relQB = RelatedModel.query();
        if (callback) callback(relQB);
        const relSoft = RelatedModel.softDeletes;
        const relConditions = relQB.conditions ? JSON.parse(JSON.stringify(relQB.conditions)) : [];
        if (relSoft) {
          const mode = relQB.trashedMode;
          if (mode === "default") relConditions.push({ operator: "AND", type: "null", column: `${relatedTable}.deleted_at` });
          else if (mode === "only") relConditions.push({ operator: "AND", type: "not_null", column: `${relatedTable}.deleted_at` });
        }
        const where = this.buildWhereClause(relConditions);
        const parts = [];
        const params = [];
        if (cfg.type === "hasMany" || cfg.type === "hasOne") {
          const foreignKey = cfg.foreignKey;
          const localKey = cfg.localKey || "id";
          parts.push(`${relatedTable}.${foreignKey} = ${parentTable}.${localKey}`);
        } else if (cfg.type === "belongsTo") {
          const foreignKey = cfg.foreignKey;
          const ownerKey = cfg.ownerKey || "id";
          parts.push(`${relatedTable}.${ownerKey} = ${parentTable}.${foreignKey}`);
        } else if (cfg.type === "morphMany" || cfg.type === "morphOne") {
          const name = cfg.morphName;
          const typeColumn = cfg.typeColumn || `${name}_type`;
          const idColumn = cfg.idColumn || `${name}_id`;
          const localKey = cfg.localKey || "id";
          const morphTypes = Eloquent.getPossibleMorphTypesForModel(this.model);
          parts.push(`${relatedTable}.${idColumn} = ${parentTable}.${localKey}`);
          parts.push(`${relatedTable}.${typeColumn} IN (${morphTypes.map(() => "?").join(", ")})`);
          params.push(...morphTypes);
        } else if (cfg.type === "belongsToMany") {
          const pivotTable = this.prefixTableWithDatabase(
            cfg.table || [this.model.name.toLowerCase(), RelatedModel.name.toLowerCase()].sort().join("_")
          );
          const fpk = cfg.foreignPivotKey || `${this.model.name.toLowerCase()}_id`;
          const rpk = cfg.relatedPivotKey || `${RelatedModel.name.toLowerCase()}_id`;
          const parentKey = cfg.parentKey || "id";
          const relatedKey = cfg.relatedKey || "id";
          const join = `FROM ${relatedTable} JOIN ${pivotTable} ON ${relatedTable}.${relatedKey} = ${pivotTable}.${rpk}`;
          const link = `${pivotTable}.${fpk} = ${parentTable}.${parentKey}`;
          const whereSql2 = where.sql ? ` AND ${where.sql}` : "";
          const sql2 = `SELECT 1 ${join} WHERE ${link}${whereSql2}`;
          return { sql: sql2, params: [...where.params] };
        } else {
          return { sql: "SELECT 1 WHERE 0=1", params: [] };
        }
        const whereSql = where.sql ? ` AND ${where.sql}` : "";
        const sql = `SELECT 1 FROM ${relatedTable} WHERE ${parts.join(" AND ")}${whereSql}`;
        params.push(...where.params);
        return { sql, params };
      }
      buildHasMorphSubquery(relationName, morphTypes, callback) {
        const cfg = Eloquent.getRelationConfig(this.model, relationName);
        if (!cfg || cfg.type !== "morphTo") {
          throw new Error(`Relation '${relationName}' must be a morphTo relationship`);
        }
        const typeColumn = cfg.typeColumn || `${cfg.morphName}_type`;
        const idColumn = cfg.idColumn || `${cfg.morphName}_id`;
        const parentTable = this.resolveTableName(this.model, this.tableName);
        const resolvedTypes = morphTypes.map((t) => {
          if (typeof t === "string") {
            const model = Eloquent.getModelForMorphType(t);
            if (!model) {
              throw new Error(`Cannot resolve model for morph type '${t}'`);
            }
            return { morphType: t, model };
          } else {
            return { morphType: Eloquent.getMorphTypeForModel(t), model: t };
          }
        });
        const allParts = [];
        const allParams = [];
        for (const { morphType, model: RelatedModel } of resolvedTypes) {
          const relatedTable = this.resolveTableName(RelatedModel);
          const relQB = RelatedModel.query();
          if (callback) callback(relQB);
          const relConditions = relQB.conditions ? JSON.parse(JSON.stringify(relQB.conditions)) : [];
          const relSoft = RelatedModel.softDeletes;
          if (relSoft) {
            const mode = relQB.trashedMode;
            if (mode === "default") {
              relConditions.push({ operator: "AND", type: "null", column: `${relatedTable}.deleted_at` });
            } else if (mode === "only") {
              relConditions.push({ operator: "AND", type: "not_null", column: `${relatedTable}.deleted_at` });
            }
          }
          const where = this.buildWhereClause(relConditions);
          const whereSql = where.sql ? ` AND ${where.sql}` : "";
          const sql = `(${parentTable}.${typeColumn} = ? AND EXISTS (
                SELECT 1 FROM ${relatedTable}
                WHERE ${relatedTable}.id = ${parentTable}.${idColumn}${whereSql}
            ))`;
          allParts.push(sql);
          allParams.push(morphType, ...where.params);
        }
        return {
          sql: allParts.join(" OR "),
          params: allParams
        };
      }
      with(relations, callback) {
        if (!this.withRelations) this.withRelations = [];
        if (!this.withCallbacks) this.withCallbacks = {};
        if (!this.withColumns) this.withColumns = {};
        if (typeof relations === "string") {
          const parsed = this.parseRelationWithColumns(relations);
          this.withRelations.push(parsed.relation);
          if (parsed.columns) this.withColumns[parsed.relation] = parsed.columns;
          if (callback) this.withCallbacks[parsed.relation] = callback;
        } else if (Array.isArray(relations)) {
          for (const name of relations) {
            const parsed = this.parseRelationWithColumns(name);
            this.withRelations.push(parsed.relation);
            if (parsed.columns) this.withColumns[parsed.relation] = parsed.columns;
          }
        } else if (relations && typeof relations === "object") {
          for (const [name, value] of Object.entries(relations)) {
            this.withRelations.push(name);
            if (Array.isArray(value)) {
              this.withColumns[name] = value;
            } else if (typeof value === "function") {
              this.withCallbacks[name] = value;
            }
          }
        }
        return this;
      }
      parseRelationWithColumns(relation) {
        const colonIndex = relation.indexOf(":");
        if (colonIndex === -1) {
          return { relation };
        }
        const relName = relation.substring(0, colonIndex);
        const columnsStr = relation.substring(colonIndex + 1);
        const columns = columnsStr.split(",").map((col) => col.trim()).filter((col) => col.length > 0);
        return { relation: relName, columns };
      }
      withWhereHas(relation, callback) {
        this.whereHas(relation, callback);
        return this.with(relation, callback);
      }
      without(relations) {
        if (!this.withRelations) return this;
        const relationsToRemove = Array.isArray(relations) ? relations : [relations];
        this.withRelations = this.withRelations.filter((rel) => !relationsToRemove.includes(rel));
        for (const rel of relationsToRemove) {
          if (this.withCallbacks) delete this.withCallbacks[rel];
          if (this.withColumns) delete this.withColumns[rel];
        }
        return this;
      }
      withOnly(relations) {
        this.withRelations = [];
        this.withCallbacks = {};
        this.withColumns = {};
        return this.with(relations);
      }
      withTrashed() {
        this.trashedMode = "with";
        return this;
      }
      onlyTrashed() {
        this.trashedMode = "only";
        return this;
      }
      withoutTrashed() {
        this.trashedMode = "default";
        return this;
      }
      latestOfMany(column = "created_at") {
        return this.ofMany(column, "max");
      }
      oldestOfMany(column = "created_at") {
        return this.ofMany(column, "min");
      }
      ofMany(column, aggregate) {
        const table = this.resolveTableName(this.model, this.tableName);
        const subQuery = this.clone();
        subQuery.selectColumns = [`${aggregate.toUpperCase()}(${column}) as aggregate_value`];
        subQuery.limitValue = void 0;
        subQuery.offsetValue = void 0;
        subQuery.orderByClauses = [];
        const subQuerySql = subQuery.buildSelectSql();
        this.whereRaw(`${column} = (${subQuerySql.sql})`, subQuerySql.params);
        this.orderBy(column, aggregate === "max" ? "desc" : "asc").limit(1);
        return this;
      }
      clone() {
        const cloned = new _QueryBuilder(this.model);
        cloned.tableName = this.tableName;
        cloned.conditions = this.conditions ? JSON.parse(JSON.stringify(this.conditions)) : [];
        cloned.selectColumns = this.selectColumns ? [...this.selectColumns] : ["*"];
        cloned.joins = this.joins ? [...this.joins] : [];
        cloned.unions = this.unions ? [...this.unions] : [];
        cloned.limitValue = this.limitValue;
        cloned.offsetValue = this.offsetValue;
        cloned.orderByClauses = this.orderByClauses ? [...this.orderByClauses] : [];
        cloned.groupByColumns = this.groupByColumns ? [...this.groupByColumns] : [];
        cloned.havingConditions = this.havingConditions ? JSON.parse(JSON.stringify(this.havingConditions)) : [];
        cloned.withRelations = this.withRelations ? [...this.withRelations] : [];
        cloned.withCallbacks = this.withCallbacks ? { ...this.withCallbacks } : void 0;
        cloned.withColumns = this.withColumns ? { ...this.withColumns } : void 0;
        cloned.trashedMode = this.trashedMode;
        cloned.selectBindings = this.selectBindings ? [...this.selectBindings] : [];
        cloned.pivotConfig = this.pivotConfig ? { table: this.pivotConfig.table, alias: this.pivotConfig.alias, columns: new Set(this.pivotConfig.columns) } : void 0;
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
        if (!ids || ids.length === 0) return [];
        const unique = Array.from(new Set(ids));
        const chunks = this.chunkArray(unique, _QueryBuilder.IN_CHUNK_SIZE);
        const all = [];
        for (const c of chunks) {
          const rows = await fetcher(c);
          if (rows && rows.length) all.push(...rows);
        }
        return all;
      }
      // BelongsToMany helpers
      setPivotSource(table, alias = "pivot") {
        if (!this.pivotConfig) this.pivotConfig = { table: this.prefixTableWithDatabase(table), alias, columns: /* @__PURE__ */ new Set() };
        return this;
      }
      as(alias) {
        if (!this.pivotConfig) return this;
        this.pivotConfig.alias = alias;
        return this;
      }
      withPivot(...columns) {
        if (!this.pivotConfig) return this;
        for (const col of columns) {
          if (!col) continue;
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
        if (typeof scopeMethod === "function") {
          return scopeMethod.call(model, this, ...args);
        }
        return this;
      }
      applyCast(value, castType) {
        if (value === null || value === void 0) return value;
        switch (castType) {
          case "integer":
          case "int":
            return parseInt(value, 10);
          case "float":
          case "double":
          case "decimal":
            return parseFloat(value);
          case "boolean":
          case "bool":
            return Boolean(value);
          case "string":
            return String(value);
          case "datetime":
            return new Date(value);
          case "array":
          case "json":
            return typeof value === "string" ? JSON.parse(value) : value;
          default:
            return value;
        }
      }
      async loadRelations(instances, relations, model, prefix) {
        if (!relations || relations.length === 0) return;
        const currentModel = model || this.model;
        this.debugLog("Loading relations", { instanceCount: instances.length, relations, model: currentModel.name });
        const groupedRelations = /* @__PURE__ */ new Map();
        for (const relation of relations) {
          const parts = relation.split(".");
          const relationKey = parts[0];
          if (!groupedRelations.has(relationKey)) {
            groupedRelations.set(relationKey, []);
          }
          if (parts.length > 1) {
            groupedRelations.get(relationKey).push(parts.slice(1).join("."));
          }
        }
        for (const [relationKey, subRelations] of groupedRelations) {
          const fullPath = prefix ? `${prefix}.${relationKey}` : relationKey;
          const cfg = Eloquent.getRelationConfig(currentModel, relationKey);
          const needsLoad = instances.some((inst) => !Object.prototype.hasOwnProperty.call(inst, relationKey));
          if (needsLoad) {
            await this.loadSingleRelation(instances, relationKey, currentModel, fullPath);
          }
          if (subRelations.length > 0) {
            const relValues = instances.map((inst) => inst[relationKey]).filter((v) => v !== null && v !== void 0);
            if (!cfg) continue;
            if (cfg.type === "morphTo") {
              const groups = /* @__PURE__ */ new Map();
              for (const val of relValues) {
                if (Array.isArray(val)) {
                  for (const item of val) {
                    const ctor = item && item.constructor;
                    if (!ctor) continue;
                    let arr = groups.get(ctor);
                    if (!arr) {
                      arr = [];
                      groups.set(ctor, arr);
                    }
                    arr.push(item);
                  }
                } else {
                  const ctor = val && val.constructor;
                  if (!ctor) continue;
                  let arr = groups.get(ctor);
                  if (!arr) {
                    arr = [];
                    groups.set(ctor, arr);
                  }
                  arr.push(val);
                }
              }
              for (const [ctor, list] of groups) {
                if (!ctor) continue;
                await this.loadRelations(list, subRelations, ctor, fullPath);
              }
            } else {
              let list = [];
              for (const v of relValues) {
                if (Array.isArray(v)) list.push(...v);
                else list.push(v);
              }
              const nestedModel = typeof cfg.model === "string" ? Eloquent.getModelForMorphType(cfg.model) : cfg.model;
              await this.loadRelations(list, subRelations, nestedModel, fullPath);
            }
          }
        }
      }
      async loadSingleRelation(instances, relationName, model, fullPath) {
        var _a, _b;
        const config = Eloquent.getRelationConfig(model, relationName);
        if (!config) {
          throw new Error(`Relationship '${relationName}' does not exist on model ${model.name}`);
        }
        const type = config.type;
        if (type === "belongsTo") {
          const RelatedModel = typeof config.model === "string" ? Eloquent.getModelForMorphType(config.model) : config.model;
          if (!RelatedModel) {
            throw new Error(`Model '${config.model}' not found in morph map`);
          }
          const foreignKey = config.foreignKey;
          const ownerKey = config.ownerKey || "id";
          const foreignKeys = instances.map((inst) => inst[foreignKey]).filter((id) => id !== null && id !== void 0);
          if (foreignKeys.length === 0) return;
          const cb = this.withCallbacks && this.withCallbacks[fullPath];
          const relatedInstances = await this.getInBatches(foreignKeys, async (chunk) => {
            const qb = RelatedModel.query().whereIn(ownerKey, chunk);
            if (cb) cb(qb);
            return qb.get();
          });
          const relatedCollection = new Collection();
          for (const rel of relatedInstances) relatedCollection.push(rel);
          for (const rel of relatedInstances) {
            try {
              Object.defineProperty(rel, "__collection", { value: relatedCollection, enumerable: false, configurable: true, writable: true });
            } catch {
            }
          }
          const map = new Map(relatedInstances.map((rel) => [rel[ownerKey], rel]));
          for (const inst of instances) {
            const target = map.get(inst[foreignKey]) || null;
            inst[relationName] = target;
            try {
              const holder = inst.__relations || {};
              if (!inst.__relations) {
                Object.defineProperty(inst, "__relations", { value: holder, enumerable: false, configurable: true, writable: true });
              }
              holder[relationName] = true;
            } catch {
            }
          }
        } else if (type === "hasMany") {
          const RelatedModel = typeof config.model === "string" ? Eloquent.getModelForMorphType(config.model) : config.model;
          if (!RelatedModel) {
            throw new Error(`Model '${config.model}' not found in morph map`);
          }
          const foreignKey = config.foreignKey;
          const localKey = config.localKey || "id";
          const localKeys = instances.map((inst) => inst[localKey]).filter((id) => id !== null && id !== void 0);
          if (localKeys.length === 0) return;
          const cb = this.withCallbacks && this.withCallbacks[fullPath];
          const relatedInstances = await this.getInBatches(localKeys, async (chunk) => {
            const qb = RelatedModel.query().whereIn(foreignKey, chunk);
            if (cb) cb(qb);
            return qb.get();
          });
          const relatedCollection = new Collection();
          for (const rel of relatedInstances) relatedCollection.push(rel);
          for (const rel of relatedInstances) {
            try {
              Object.defineProperty(rel, "__collection", { value: relatedCollection, enumerable: false, configurable: true, writable: true });
            } catch {
            }
          }
          const map = /* @__PURE__ */ new Map();
          for (const rel of relatedInstances) {
            const key = rel[foreignKey];
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(rel);
          }
          for (const inst of instances) {
            inst[relationName] = map.get(inst[localKey]) || [];
            try {
              const holder = inst.__relations || {};
              if (!inst.__relations) {
                Object.defineProperty(inst, "__relations", { value: holder, enumerable: false, configurable: true, writable: true });
              }
              holder[relationName] = true;
            } catch {
            }
          }
        } else if (type === "hasOne") {
          const RelatedModel = typeof config.model === "string" ? Eloquent.getModelForMorphType(config.model) : config.model;
          if (!RelatedModel) {
            throw new Error(`Model '${config.model}' not found in morph map`);
          }
          const foreignKey = config.foreignKey;
          const localKey = config.localKey || "id";
          const localKeys = instances.map((inst) => inst[localKey]).filter((id) => id !== null && id !== void 0);
          if (localKeys.length === 0) return;
          const cb = this.withCallbacks && this.withCallbacks[fullPath];
          const relatedInstances = await this.getInBatches(localKeys, async (chunk) => {
            const qb = RelatedModel.query().whereIn(foreignKey, chunk);
            if (cb) cb(qb);
            return qb.get();
          });
          const relatedCollection = new Collection();
          for (const rel of relatedInstances) relatedCollection.push(rel);
          for (const rel of relatedInstances) {
            try {
              Object.defineProperty(rel, "__collection", { value: relatedCollection, enumerable: false, configurable: true, writable: true });
            } catch {
            }
          }
          const map = /* @__PURE__ */ new Map();
          for (const rel of relatedInstances) {
            const key = rel[foreignKey];
            map.set(key, rel);
          }
          for (const inst of instances) {
            inst[relationName] = map.get(inst[localKey]) || null;
            try {
              const holder = inst.__relations || {};
              if (!inst.__relations) {
                Object.defineProperty(inst, "__relations", { value: holder, enumerable: false, configurable: true, writable: true });
              }
              holder[relationName] = true;
            } catch {
            }
          }
        } else if (type === "morphOne") {
          const RelatedModel = typeof config.model === "string" ? Eloquent.getModelForMorphType(config.model) : config.model;
          const name = config.morphName;
          const typeColumn = config.typeColumn || `${name}_type`;
          const idColumn = config.idColumn || `${name}_id`;
          const localKey = config.localKey || "id";
          const localKeys = instances.map((inst) => inst[localKey]).filter((id) => id !== null && id !== void 0);
          if (localKeys.length === 0) return;
          const morphTypes = Eloquent.getPossibleMorphTypesForModel(model);
          const cb = this.withCallbacks && this.withCallbacks[fullPath];
          const relatedInstances = await this.getInBatches(localKeys, async (chunk) => {
            const qb = RelatedModel.query().whereIn(typeColumn, morphTypes).whereIn(idColumn, chunk);
            if (cb) cb(qb);
            return qb.get();
          });
          const relatedCollection = new Collection();
          for (const rel of relatedInstances) relatedCollection.push(rel);
          for (const rel of relatedInstances) {
            try {
              Object.defineProperty(rel, "__collection", { value: relatedCollection, enumerable: false, configurable: true, writable: true });
            } catch {
            }
          }
          const map = /* @__PURE__ */ new Map();
          for (const rel of relatedInstances) {
            const key = rel[idColumn];
            map.set(key, rel);
          }
          for (const inst of instances) {
            inst[relationName] = map.get(inst[localKey]) || null;
            try {
              const holder = inst.__relations || {};
              if (!inst.__relations) {
                Object.defineProperty(inst, "__relations", { value: holder, enumerable: false, configurable: true, writable: true });
              }
              holder[relationName] = true;
            } catch {
            }
          }
        } else if (type === "morphMany") {
          const RelatedModel = typeof config.model === "string" ? Eloquent.getModelForMorphType(config.model) : config.model;
          const name = config.morphName;
          const typeColumn = config.typeColumn || `${name}_type`;
          const idColumn = config.idColumn || `${name}_id`;
          const localKey = config.localKey || "id";
          const localKeys = instances.map((inst) => inst[localKey]).filter((id) => id !== null && id !== void 0);
          if (localKeys.length === 0) return;
          const morphTypes = Eloquent.getPossibleMorphTypesForModel(model);
          const cb = this.withCallbacks && this.withCallbacks[fullPath];
          const relatedInstances = await this.getInBatches(localKeys, async (chunk) => {
            const qb = RelatedModel.query().whereIn(typeColumn, morphTypes).whereIn(idColumn, chunk);
            if (cb) cb(qb);
            return qb.get();
          });
          const relatedCollection = new Collection();
          for (const rel of relatedInstances) relatedCollection.push(rel);
          for (const rel of relatedInstances) {
            try {
              Object.defineProperty(rel, "__collection", { value: relatedCollection, enumerable: false, configurable: true, writable: true });
            } catch {
            }
          }
          const map = /* @__PURE__ */ new Map();
          for (const rel of relatedInstances) {
            const key = rel[idColumn];
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(rel);
          }
          for (const inst of instances) {
            inst[relationName] = map.get(inst[localKey]) || [];
            try {
              const holder = inst.__relations || {};
              if (!inst.__relations) {
                Object.defineProperty(inst, "__relations", { value: holder, enumerable: false, configurable: true, writable: true });
              }
              holder[relationName] = true;
            } catch {
            }
          }
        } else if (type === "morphOneOfMany") {
          const RelatedModel = typeof config.model === "string" ? Eloquent.getModelForMorphType(config.model) : config.model;
          const name = config.morphName;
          const typeColumn = config.typeColumn || `${name}_type`;
          const idColumn = config.idColumn || `${name}_id`;
          const localKey = config.localKey || "id";
          const column = config.column || "created_at";
          const aggregate = config.aggregate || "max";
          const localKeys = instances.map((inst) => inst[localKey]).filter((id) => id !== null && id !== void 0);
          if (localKeys.length === 0) return;
          const morphTypes = Eloquent.getPossibleMorphTypesForModel(model);
          const relatedTable = this.resolveTableName(RelatedModel);
          const cb = this.withCallbacks && this.withCallbacks[fullPath];
          const relatedInstances = await this.getInBatches(localKeys, async (chunk) => {
            const aggFn = aggregate === "max" ? "MAX" : "MIN";
            const qb = RelatedModel.query().whereIn(typeColumn, morphTypes).whereIn(idColumn, chunk).whereRaw(`${relatedTable}.${column} = (
                        SELECT ${aggFn}(sub.${column}) FROM ${relatedTable} sub
                        WHERE sub.${typeColumn} = ${relatedTable}.${typeColumn}
                        AND sub.${idColumn} = ${relatedTable}.${idColumn}
                    )`);
            if (cb) cb(qb);
            return qb.get();
          });
          const relatedCollection = new Collection();
          for (const rel of relatedInstances) relatedCollection.push(rel);
          for (const rel of relatedInstances) {
            try {
              Object.defineProperty(rel, "__collection", { value: relatedCollection, enumerable: false, configurable: true, writable: true });
            } catch {
            }
          }
          const map = /* @__PURE__ */ new Map();
          for (const rel of relatedInstances) {
            const key = rel[idColumn];
            if (!map.has(key)) {
              map.set(key, rel);
            }
          }
          for (const inst of instances) {
            inst[relationName] = map.get(inst[localKey]) || null;
            try {
              const holder = inst.__relations || {};
              if (!inst.__relations) {
                Object.defineProperty(inst, "__relations", { value: holder, enumerable: false, configurable: true, writable: true });
              }
              holder[relationName] = true;
            } catch {
            }
          }
        } else if (type === "morphTo") {
          const name = config.morphName;
          const typeColumn = config.typeColumn || `${name}_type`;
          const idColumn = config.idColumn || `${name}_id`;
          const byType = /* @__PURE__ */ new Map();
          for (const inst of instances) {
            const t = inst[typeColumn];
            const id = inst[idColumn];
            if (t === null || t === void 0 || id === null || id === void 0) continue;
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
              const qb = ModelCtor.query().whereIn("id", chunk);
              if (cb) cb(qb);
              return qb.get();
            });
            const relatedCollection = new Collection();
            for (const rel of relatedInstances) relatedCollection.push(rel);
            for (const rel of relatedInstances) {
              try {
                Object.defineProperty(rel, "__collection", { value: relatedCollection, enumerable: false, configurable: true, writable: true });
              } catch {
              }
            }
            const map = new Map(relatedInstances.map((rel) => [rel.id, rel]));
            for (const inst of list) {
              inst[relationName] = map.get(inst[idColumn]) || null;
              try {
                const holder = inst.__relations || {};
                if (!inst.__relations) {
                  Object.defineProperty(inst, "__relations", { value: holder, enumerable: false, configurable: true, writable: true });
                }
                holder[relationName] = true;
              } catch {
              }
            }
          }
        } else if (type === "hasManyThrough" || type === "hasOneThrough") {
          const RelatedModel = typeof config.model === "string" ? Eloquent.getModelForMorphType(config.model) : config.model;
          const ThroughModel = typeof config.through === "string" ? Eloquent.getModelForMorphType(config.through) : config.through;
          if (!RelatedModel) {
            throw new Error(`Related model '${config.model}' not found in morph map`);
          }
          if (!ThroughModel) {
            throw new Error(`Through model '${config.through}' not found in morph map`);
          }
          const relatedTable = this.resolveTableName(RelatedModel);
          const throughTable = this.resolveTableName(ThroughModel);
          const firstKey = config.firstKey || `${model.name.toLowerCase()}_id`;
          const secondKey = config.secondKey || `${ThroughModel.name.toLowerCase()}_id`;
          const localKey = config.localKey || "id";
          const secondLocalKey = config.secondLocalKey || "id";
          const parentIds = instances.map((inst) => inst[localKey]).filter((id) => id !== null && id !== void 0);
          if (parentIds.length === 0) return;
          const cb = this.withCallbacks && this.withCallbacks[fullPath];
          const rows = await this.getInBatches(parentIds, async (chunk) => {
            const qb = RelatedModel.query().addSelect(`${relatedTable}.*`).addSelect(`${throughTable}.${firstKey} as __through_fk`).join(throughTable, `${relatedTable}.${secondKey}`, "=", `${throughTable}.${secondLocalKey}`).whereIn(`${throughTable}.${firstKey}`, chunk);
            if (cb) cb(qb);
            return qb.get();
          });
          const relatedCollection = new Collection();
          for (const rel of rows) relatedCollection.push(rel);
          for (const rel of rows) {
            try {
              Object.defineProperty(rel, "__collection", { value: relatedCollection, enumerable: false, configurable: true, writable: true });
            } catch {
            }
          }
          if (type === "hasOneThrough") {
            const map = /* @__PURE__ */ new Map();
            for (const rel of rows) {
              const owner = rel["__through_fk"];
              if (owner === null || owner === void 0) continue;
              if (!map.has(owner)) {
                delete rel["__through_fk"];
                map.set(owner, rel);
              }
            }
            for (const inst of instances) {
              inst[relationName] = map.get(inst[localKey]) || null;
              try {
                const holder = inst.__relations || {};
                if (!inst.__relations) {
                  Object.defineProperty(inst, "__relations", { value: holder, enumerable: false, configurable: true, writable: true });
                }
                holder[relationName] = true;
              } catch {
              }
            }
          } else {
            const map = /* @__PURE__ */ new Map();
            for (const rel of rows) {
              const owner = rel["__through_fk"];
              if (owner === null || owner === void 0) continue;
              let arr = map.get(owner);
              if (!arr) {
                arr = [];
                map.set(owner, arr);
              }
              delete rel["__through_fk"];
              arr.push(rel);
            }
            for (const inst of instances) {
              inst[relationName] = map.get(inst[localKey]) || [];
              try {
                const holder = inst.__relations || {};
                if (!inst.__relations) {
                  Object.defineProperty(inst, "__relations", { value: holder, enumerable: false, configurable: true, writable: true });
                }
                holder[relationName] = true;
              } catch {
              }
            }
          }
        } else if (type === "belongsToMany") {
          const RelatedModel = typeof config.model === "string" ? Eloquent.getModelForMorphType(config.model) : config.model;
          if (!RelatedModel) {
            throw new Error(`Model '${config.model}' not found in morph map`);
          }
          const relatedTable = this.resolveTableName(RelatedModel);
          const pivotTable = this.prefixTableWithDatabase(
            config.table || [model.name.toLowerCase(), RelatedModel.name.toLowerCase()].sort().join("_")
          );
          const fpk = config.foreignPivotKey || `${model.name.toLowerCase()}_id`;
          const rpk = config.relatedPivotKey || `${RelatedModel.name.toLowerCase()}_id`;
          const parentKey = config.parentKey || "id";
          const relatedKey = config.relatedKey || "id";
          const parentIds = instances.map((inst) => inst[parentKey]).filter((id) => id !== null && id !== void 0);
          if (parentIds.length === 0) return;
          const cb = this.withCallbacks && this.withCallbacks[fullPath];
          const columns = ((_a = this.pivotConfig) == null ? void 0 : _a.columns) ? Array.from(this.pivotConfig.columns) : [];
          const alias = ((_b = this.pivotConfig) == null ? void 0 : _b.alias) || "pivot";
          const rows = await this.getInBatches(parentIds, async (chunk) => {
            var _a2;
            const qb = RelatedModel.query().addSelect(`${relatedTable}.*`).addSelect(`${pivotTable}.${fpk} as __pivot_fk`).join(pivotTable, `${relatedTable}.${relatedKey}`, "=", `${pivotTable}.${rpk}`).whereIn(`${pivotTable}.${fpk}`, chunk);
            if (columns.length > 0) {
              (_a2 = qb.setPivotSource) == null ? void 0 : _a2.call(qb, pivotTable, alias);
              for (const col of columns) {
                qb.addSelect(`${pivotTable}.${col} AS ${alias}__${col}`);
              }
            }
            if (cb) cb(qb);
            return qb.get();
          });
          const relatedCollection = new Collection();
          for (const rel of rows) relatedCollection.push(rel);
          for (const rel of rows) {
            try {
              Object.defineProperty(rel, "__collection", { value: relatedCollection, enumerable: false, configurable: true, writable: true });
            } catch {
            }
          }
          const map = /* @__PURE__ */ new Map();
          for (const rel of rows) {
            const owner = rel["__pivot_fk"];
            if (owner === null || owner === void 0) continue;
            let arr = map.get(owner);
            if (!arr) {
              arr = [];
              map.set(owner, arr);
            }
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
            delete rel["__pivot_fk"];
            arr.push(rel);
          }
          for (const inst of instances) {
            inst[relationName] = map.get(inst[parentKey]) || [];
            try {
              const holder = inst.__relations || {};
              if (!inst.__relations) {
                Object.defineProperty(inst, "__relations", { value: holder, enumerable: false, configurable: true, writable: true });
              }
              holder[relationName] = true;
            } catch {
            }
          }
        }
      }
      async chunk(size, callback) {
        let page = 0;
        while (true) {
          const results = await this.clone().offset(page * size).limit(size).get();
          if (results.length === 0) break;
          await callback(results);
          page++;
        }
      }
      buildWhereClause(conditions) {
        let sql = "";
        const params = [];
        for (let i = 0; i < conditions.length; i++) {
          const cond = conditions[i];
          if (i > 0) sql += ` ${cond.operator} `;
          if ("group" in cond) {
            const sub = this.buildWhereClause(cond.group);
            if (sub.sql) {
              sql += `(${sub.sql})`;
              params.push(...sub.params);
            } else {
              if (sql.endsWith(` ${cond.operator} `)) {
                sql = sql.slice(0, -` ${cond.operator} `.length);
              }
            }
          } else if (cond.type === "basic") {
            sql += `${cond.column} ${cond.conditionOperator} ?`;
            params.push(cond.value);
          } else if (cond.type === "in") {
            const values = cond.value || [];
            if (values.length === 0) {
              sql += `0=1`;
            } else {
              sql += `${cond.column} IN (${values.map(() => "?").join(", ")})`;
              params.push(...values);
            }
          } else if (cond.type === "not_in") {
            const values = cond.value || [];
            if (values.length === 0) {
              sql += `1=1`;
            } else {
              sql += `${cond.column} NOT IN (${values.map(() => "?").join(", ")})`;
              params.push(...values);
            }
          } else if (cond.type === "null") {
            sql += `${cond.column} IS NULL`;
          } else if (cond.type === "not_null") {
            sql += `${cond.column} IS NOT NULL`;
          } else if (cond.type === "between") {
            sql += `${cond.column} BETWEEN ? AND ?`;
            params.push(cond.value[0], cond.value[1]);
          } else if (cond.type === "not_between") {
            sql += `${cond.column} NOT BETWEEN ? AND ?`;
            params.push(cond.value[0], cond.value[1]);
          } else if (cond.type === "raw") {
            sql += `(${cond.sql})`;
            params.push(...cond.bindings);
          }
        }
        return { sql, params };
      }
      async first() {
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
          throw new Error("No results found for query");
        }
        return result;
      }
      async firstOr(defaultValue) {
        const result = await this.first();
        if (result) {
          return result;
        }
        return typeof defaultValue === "function" ? defaultValue() : defaultValue;
      }
      toSql() {
        const { sql } = this.buildSelectSql({ includeOrderLimit: true });
        return sql;
      }
      toRawSql() {
        const { sql, params } = this.buildSelectSql({ includeOrderLimit: true });
        let rawSql = sql;
        for (const param of params) {
          const value = typeof param === "string" ? `'${param}'` : param;
          rawSql = rawSql.replace("?", String(value));
        }
        return rawSql;
      }
      dump() {
        console.log("SQL:", this.toSql());
        console.log("Raw SQL:", this.toRawSql());
        return this;
      }
      dd() {
        this.dump();
        throw new Error("Execution halted by dd()");
      }
      whereColumn(first, operatorOrSecond, second) {
        if (second === void 0) {
          this.conditions.push({
            operator: "AND",
            type: "raw",
            sql: `${first} = ${operatorOrSecond}`,
            bindings: []
          });
        } else {
          this.conditions.push({
            operator: "AND",
            type: "raw",
            sql: `${first} ${operatorOrSecond} ${second}`,
            bindings: []
          });
        }
        return this;
      }
      orWhereColumn(first, operatorOrSecond, second) {
        if (second === void 0) {
          this.conditions.push({
            operator: "OR",
            type: "raw",
            sql: `${first} = ${operatorOrSecond}`,
            bindings: []
          });
        } else {
          this.conditions.push({
            operator: "OR",
            type: "raw",
            sql: `${first} ${operatorOrSecond} ${second}`,
            bindings: []
          });
        }
        return this;
      }
      async get() {
        var _a;
        if (this.model.usesSushi()) {
          return this.getSushi();
        }
        const connection = await Eloquent.resolveConnection();
        const hasUnions = this.unions.length > 0;
        const main = this.buildSelectSql({ includeOrderLimit: !hasUnions });
        let sql = main.sql;
        let allParams = [...main.params];
        this.debugLog("Executing query", { sql, params: allParams, hasUnions });
        if (hasUnions) {
          for (const union of this.unions) {
            const unionData = union.query.buildSelectSql({ includeOrderLimit: false });
            sql += ` UNION ${union.all ? "ALL " : ""}${unionData.sql}`;
            allParams.push(...unionData.params);
          }
          if (this.orderByClauses.length > 0) {
            const order = this.orderByClauses.map((o) => o.column === "RAND()" ? `RAND()` : `${o.column} ${o.direction}`).join(", ");
            sql += ` ORDER BY ${order}`;
          }
          if (this.limitValue !== void 0) sql += ` LIMIT ${this.limitValue}`;
          if (this.offsetValue !== void 0) sql += ` OFFSET ${this.offsetValue}`;
        }
        this.ensureReadOnlySql(sql, "get");
        const [rows] = await connection.query(sql, allParams);
        const instances = rows.map((row) => {
          const instance = new this.model();
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
          const schema = this.model.schema;
          const data = schema ? schema.parse(row) : row;
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
        const collectionId = this.model.generateCollectionId();
        const collectionsRegistry = this.model.getCollectionsRegistry();
        collectionsRegistry.set(collectionId, instances);
        for (const inst of instances) {
          try {
            Object.defineProperty(inst, "__collection", {
              value: collection,
              enumerable: false,
              configurable: true,
              writable: true
            });
            inst.__collectionId = collectionId;
          } catch {
          }
        }
        this.debugLog("Query completed", {
          resultCount: instances.length,
          hasRelations: (((_a = this.withRelations) == null ? void 0 : _a.length) ?? 0) > 0,
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
        rows = this.applySushiConditions(rows, this.conditions);
        if (rows.length === 0) {
          return functionName === "COUNT" ? 0 : 0;
        }
        switch (functionName) {
          case "COUNT":
            return column === "*" ? rows.length : rows.filter((r) => r[column] !== null && r[column] !== void 0).length;
          case "SUM":
            return rows.reduce((sum, r) => sum + (Number(r[column]) || 0), 0);
          case "AVG":
            const values = rows.map((r) => Number(r[column]) || 0);
            return values.reduce((a, b) => a + b, 0) / values.length;
          case "MAX":
            return Math.max(...rows.map((r) => Number(r[column]) || 0));
          case "MIN":
            return Math.min(...rows.map((r) => Number(r[column]) || 0));
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
        this.debugLog("Executing Sushi query", {
          model: this.model.name,
          totalRows: rows.length,
          conditions: this.conditions.length
        });
        rows = this.applySushiConditions(rows, this.conditions);
        if (this.orderByClauses.length > 0) {
          rows = this.applySushiOrderBy(rows);
        }
        if (this.offsetValue !== void 0 && this.offsetValue > 0) {
          rows = rows.slice(this.offsetValue);
        }
        if (this.limitValue !== void 0) {
          rows = rows.slice(0, this.limitValue);
        }
        if (this.selectColumns.length > 0 && !this.selectColumns.includes("*")) {
          rows = rows.map((row) => {
            const selected = {};
            for (const col of this.selectColumns) {
              if (col in row) {
                selected[col] = row[col];
              }
            }
            return selected;
          });
        }
        const instances = rows.map((row) => {
          const instance = new this.model();
          const schema = this.model.schema;
          const data = schema ? schema.parse(row) : row;
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
        const collectionId = this.model.generateCollectionId();
        const collectionsRegistry = this.model.getCollectionsRegistry();
        collectionsRegistry.set(collectionId, instances);
        for (const inst of instances) {
          try {
            Object.defineProperty(inst, "__collection", {
              value: collection,
              enumerable: false,
              configurable: true,
              writable: true
            });
            inst.__collectionId = collectionId;
          } catch {
          }
        }
        this.debugLog("Sushi query completed", { resultCount: instances.length });
        return collection;
      }
      /**
       * Apply conditions to Sushi rows (in-memory filtering)
       */
      applySushiConditions(rows, conditions) {
        if (conditions.length === 0) return rows;
        return rows.filter((row) => {
          let result = true;
          for (let i = 0; i < conditions.length; i++) {
            const cond = conditions[i];
            const condResult = this.evaluateSushiCondition(row, cond);
            if (i === 0) {
              result = condResult;
            } else if (cond.operator === "AND") {
              result = result && condResult;
            } else {
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
        if ("group" in cond) {
          const filtered = this.applySushiConditions([row], cond.group);
          return filtered.length > 0;
        }
        if (cond.type === "raw") {
          return true;
        }
        const value = row[cond.column];
        switch (cond.type) {
          case "basic": {
            const op = cond.conditionOperator;
            const target = cond.value;
            switch (op) {
              case "=":
                return value == target;
              case "!=":
              case "<>":
                return value != target;
              case ">":
                return value > target;
              case ">=":
                return value >= target;
              case "<":
                return value < target;
              case "<=":
                return value <= target;
              case "LIKE":
              case "like": {
                if (typeof value !== "string" || typeof target !== "string") return false;
                const pattern = target.replace(/%/g, ".*").replace(/_/g, ".");
                return new RegExp(`^${pattern}$`, "i").test(value);
              }
              default:
                return value == target;
            }
          }
          case "in":
            return Array.isArray(cond.value) && cond.value.includes(value);
          case "not_in":
            return Array.isArray(cond.value) && !cond.value.includes(value);
          case "null":
            return value === null || value === void 0;
          case "not_null":
            return value !== null && value !== void 0;
          case "between":
            return value >= cond.value[0] && value <= cond.value[1];
          case "not_between":
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
            } else if (aVal === null || aVal === void 0) {
              comparison = 1;
            } else if (bVal === null || bVal === void 0) {
              comparison = -1;
            } else if (typeof aVal === "string" && typeof bVal === "string") {
              comparison = aVal.localeCompare(bVal);
            } else {
              comparison = aVal < bVal ? -1 : 1;
            }
            if (comparison !== 0) {
              return clause.direction === "desc" ? -comparison : comparison;
            }
          }
          return 0;
        });
      }
      buildSelectSql(options) {
        const includeOrderLimit = (options == null ? void 0 : options.includeOrderLimit) !== false;
        const baseTableName = this.tableName || this.model.table || this.model.name.toLowerCase() + "s";
        const table = this.resolveTableName(this.model, this.tableName);
        const knownSimpleTables = /* @__PURE__ */ new Set();
        if (Eloquent.shouldPrefixTableWithDatabase(baseTableName)) {
          knownSimpleTables.add(baseTableName.trim());
        }
        let sql = `SELECT ${this.isDistinct ? "DISTINCT " : ""}${this.selectColumns.join(", ")} FROM ${table}`;
        for (const j of this.joins) {
          if (Eloquent.shouldPrefixTableWithDatabase(j.table)) {
            knownSimpleTables.add(j.table.trim());
          }
          const joinTable = this.prefixTableWithDatabase(j.table);
          const first = j.first ? this.prefixColumnWithDatabase(j.first, knownSimpleTables) : j.first;
          const second = j.second ? this.prefixColumnWithDatabase(j.second, knownSimpleTables) : j.second;
          if (j.type === "cross") {
            sql += ` CROSS JOIN ${joinTable}`;
          } else {
            sql += ` ${j.type.toUpperCase()} JOIN ${joinTable} ON ${first} ${j.operator} ${second}`;
          }
        }
        const allConditions = this.conditions ? JSON.parse(JSON.stringify(this.conditions)) : [];
        const globalScopes = this.model.globalScopes;
        if (globalScopes) {
          for (const scope of globalScopes) {
            if (typeof scope === "function") {
              const scopeQuery = new _QueryBuilder(this.model);
              scope.call(this.model, scopeQuery);
              if (scopeQuery.conditions.length > 0) {
                allConditions.push({ operator: "AND", group: scopeQuery.conditions });
              }
            }
          }
        }
        const soft = this.model.softDeletes;
        if (soft) {
          if (this.trashedMode === "default") {
            allConditions.push({ operator: "AND", type: "null", column: `${table}.deleted_at` });
          } else if (this.trashedMode === "only") {
            allConditions.push({ operator: "AND", type: "not_null", column: `${table}.deleted_at` });
          }
        }
        const where = allConditions.length > 0 ? this.buildWhereClause(allConditions) : { sql: "", params: [] };
        if (where.sql) sql += ` WHERE ${where.sql}`;
        if (this.groupByColumns.length > 0) sql += ` GROUP BY ${this.groupByColumns.join(", ")}`;
        if (this.havingConditions.length > 0) {
          const having = this.buildWhereClause(this.havingConditions);
          if (having.sql) sql += ` HAVING ${having.sql}`;
          where.params.push(...having.params);
        }
        if (includeOrderLimit) {
          if (this.orderByClauses.length > 0) {
            const order = this.orderByClauses.map((o) => o.column === "RAND()" ? `RAND()` : `${o.column} ${o.direction}`).join(", ");
            sql += ` ORDER BY ${order}`;
          }
          if (this.limitValue !== void 0) sql += ` LIMIT ${this.limitValue}`;
          if (this.offsetValue !== void 0) sql += ` OFFSET ${this.offsetValue}`;
        }
        const params = [...this.selectBindings, ...where.params];
        return { sql, params };
      }
      ensureReadOnlySnippet(snippet, context) {
        const text = (snippet || "").toLowerCase();
        if (text.includes(";")) {
          throw new Error(`Read-only ORM violation in ${context}: semicolons are not allowed`);
        }
        for (const k of _QueryBuilder.FORBIDDEN_SQL) {
          const regex = new RegExp(`\\b${k}\\b`, "i");
          if (regex.test(text)) {
            throw new Error(`Read-only ORM violation in ${context}: disallowed keyword '${k}'`);
          }
        }
      }
      ensureReadOnlySql(sql, context) {
        const lc = sql.toLowerCase().trim();
        if (!lc.startsWith("select")) {
          throw new Error(`Read-only ORM violation in ${context}: only SELECT statements are permitted`);
        }
        this.ensureReadOnlySnippet(sql, context);
      }
      createProxiedInstance(instance) {
        const relationConfigs = /* @__PURE__ */ new Map();
        const accessorCache = /* @__PURE__ */ new Map();
        const proto = instance.constructor.prototype;
        for (const key of Object.getOwnPropertyNames(proto)) {
          const config = Eloquent.getRelationConfig(instance.constructor, key);
          if (config) {
            relationConfigs.set(key, config);
          }
        }
        const toPascalCase = (str) => {
          return str.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
        };
        const findAccessor = (prop) => {
          if (accessorCache.has(prop)) {
            return accessorCache.get(prop);
          }
          const accessorName = `get${toPascalCase(prop)}Attribute`;
          if (typeof proto[accessorName] === "function") {
            accessorCache.set(prop, accessorName);
            return accessorName;
          }
          accessorCache.set(prop, null);
          return null;
        };
        const loadingPromises = /* @__PURE__ */ new Map();
        return new Proxy(instance, {
          get: (target, prop) => {
            var _a;
            if (relationConfigs.has(prop)) {
              const hasLoadedData = Object.prototype.hasOwnProperty.call(target, prop);
              if (hasLoadedData) {
                return target[prop];
              }
              if (this.shouldAutoLoad(target, prop)) {
                if (!loadingPromises.has(prop)) {
                  const loadPromise2 = this.autoLoadRelation(target, prop);
                  loadingPromises.set(prop, loadPromise2);
                }
                const relationMethod = target[prop].bind(target);
                const loadPromise = loadingPromises.get(prop);
                const thenable = Object.assign(
                  function(...args) {
                    return relationMethod(...args);
                  },
                  {
                    then: (resolve, reject) => {
                      return loadPromise.then(() => {
                        const data = target[prop];
                        resolve(data);
                      }).catch(reject);
                    },
                    catch: (reject) => {
                      return loadPromise.catch(reject);
                    }
                  }
                );
                return thenable;
              }
              return target[prop];
            }
            if (typeof prop === "string" && !((_a = Object.getOwnPropertyDescriptor(proto, prop)) == null ? void 0 : _a.get)) {
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
        const globalEnabled = Eloquent.isAutomaticallyEagerLoadRelationshipsEnabled();
        const collectionAutoLoad = instance.__collectionAutoLoad;
        return globalEnabled || collectionAutoLoad;
      }
      async autoLoadRelation(instance, relationName) {
        const collection = instance.__collection;
        const globalEnabled = Eloquent.isAutomaticallyEagerLoadRelationshipsEnabled();
        const shouldLoadCollection = collection && (globalEnabled || typeof collection.isRelationshipAutoloadingEnabled === "function" && collection.isRelationshipAutoloadingEnabled());
        if (shouldLoadCollection) {
          await this.loadRelations(collection, [relationName]);
        } else {
          await this.loadRelations([instance], [relationName]);
        }
      }
    };
    _QueryBuilder.IN_CHUNK_SIZE = 1e3;
    _QueryBuilder.FORBIDDEN_SQL = [
      "insert",
      "update",
      "delete",
      "replace",
      "create",
      "drop",
      "alter",
      "truncate",
      "grant",
      "revoke",
      "load data",
      "into outfile"
    ];
    QueryBuilder = _QueryBuilder;
    Collection = class extends Array {
      constructor() {
        super(...arguments);
        this.relationshipAutoloadingEnabled = false;
      }
      withRelationshipAutoloading() {
        this.relationshipAutoloadingEnabled = true;
        for (const instance of this) {
          try {
            Object.defineProperty(instance, "__collectionAutoLoad", {
              value: true,
              enumerable: false,
              configurable: true,
              writable: true
            });
            Object.defineProperty(instance, "__collection", {
              value: this,
              enumerable: false,
              configurable: true,
              writable: true
            });
          } catch {
          }
        }
        return this;
      }
      isRelationshipAutoloadingEnabled() {
        return this.relationshipAutoloadingEnabled || Eloquent.isAutomaticallyEagerLoadRelationshipsEnabled();
      }
    };
    COLLECTION_ID_COUNTER = 0;
    ThroughBuilder = class {
      constructor(instance, throughRelation) {
        this.instance = instance;
        this.throughRelation = throughRelation;
      }
      has(finalRelation) {
        const throughModel = this.instance.constructor;
        const throughConfig = Eloquent.getRelationConfig(throughModel, this.throughRelation);
        if (!throughConfig) throw new Error(`Through relation ${this.throughRelation} not found`);
        const throughClass = throughConfig.model;
        const finalConfig = Eloquent.getRelationConfig(throughClass, finalRelation);
        if (!finalConfig) throw new Error(`Final relation ${finalRelation} not found`);
        const finalClass = finalConfig.model;
        const isOne = finalConfig.type === "belongsTo" || finalConfig.type === "hasOne";
        const firstKey = throughConfig.foreignKey;
        const secondKey = finalConfig.type === "belongsTo" ? `${throughClass.name.toLowerCase()}_id` : finalConfig.foreignKey;
        const localKey = throughConfig.localKey || "id";
        const secondLocalKey = finalConfig.type === "belongsTo" ? finalConfig.ownerKey || "id" : finalConfig.localKey || "id";
        if (isOne) {
          return this.instance.hasOneThrough(finalClass, throughClass, firstKey, secondKey, localKey, secondLocalKey);
        } else {
          return this.instance.hasManyThrough(finalClass, throughClass, firstKey, secondKey, localKey, secondLocalKey);
        }
      }
    };
    _Eloquent = class _Eloquent {
      static resolveOptions(options) {
        return {
          connectTimeout: (options == null ? void 0 : options.connectTimeout) ?? _Eloquent.options.connectTimeout,
          prefixTablesWithDatabase: (options == null ? void 0 : options.prefixTablesWithDatabase) ?? _Eloquent.options.prefixTablesWithDatabase
        };
      }
      static getActiveOptions() {
        var _a;
        return ((_a = _Eloquent.getContext()) == null ? void 0 : _a.options) || _Eloquent.options;
      }
      static resolveBindingDatabase(binding) {
        if (binding.database) {
          return binding.database;
        }
        try {
          const url = new URL(binding.connectionString);
          if (url.protocol === "mysql:") {
            return url.pathname.replace(/^\/+/, "") || void 0;
          }
        } catch {
        }
        return void 0;
      }
      static getActiveDatabaseName() {
        var _a, _b;
        return (_b = (_a = _Eloquent.getContext()) == null ? void 0 : _a.hyperdrive) == null ? void 0 : _b.database;
      }
      static shouldPrefixTableWithDatabase(table) {
        const normalized = table.trim();
        if (!normalized) return false;
        return /^[A-Za-z0-9_$]+$/.test(normalized);
      }
      static prefixTableWithDatabase(table) {
        const options = _Eloquent.getActiveOptions();
        if (!options.prefixTablesWithDatabase) {
          return table;
        }
        const database = _Eloquent.getActiveDatabaseName();
        if (!database || !_Eloquent.shouldPrefixTableWithDatabase(table)) {
          return table;
        }
        return `${database}.${table}`;
      }
      static prefixColumnWithDatabase(column, allowedTables) {
        const options = _Eloquent.getActiveOptions();
        if (!options.prefixTablesWithDatabase) {
          return column;
        }
        const database = _Eloquent.getActiveDatabaseName();
        if (!database) {
          return column;
        }
        const normalized = column.trim();
        const match = normalized.match(/^([A-Za-z0-9_$]+)\.([A-Za-z0-9_$*]+)$/);
        if (!match) {
          return column;
        }
        const table = match[1];
        const field = match[2];
        if (allowedTables && !allowedTables.has(table)) {
          return column;
        }
        return `${database}.${table}.${field}`;
      }
      static resolveTableName(model, tableOverride) {
        const table = tableOverride || model.table || model.name.toLowerCase() + "s";
        return _Eloquent.prefixTableWithDatabase(table);
      }
      static setOptions(options) {
        _Eloquent.options = _Eloquent.resolveOptions(options);
      }
      static getOptions() {
        return { ..._Eloquent.options };
      }
      static createRequestContext(options) {
        return {
          connection: null,
          connectionInitialization: null,
          hyperdrive: (options == null ? void 0 : options.hyperdrive) || null,
          options: _Eloquent.resolveOptions(options == null ? void 0 : options.eloquentOptions),
          morphMap: { ..._Eloquent.registeredMorphMap, ...(options == null ? void 0 : options.morphs) || {} },
          loadBatch: [],
          loadingPromises: /* @__PURE__ */ new Map(),
          collectionsRegistry: /* @__PURE__ */ new Map(),
          batchFlushScheduled: false,
          automaticallyEagerLoadRelationshipsEnabled: (options == null ? void 0 : options.automaticallyEagerLoadRelationshipsEnabled) ?? false,
          released: false
        };
      }
      static getContext() {
        return _Eloquent.connectionStorage.getStore() || null;
      }
      static requireContext(operation) {
        const context = _Eloquent.getContext();
        if (!context) {
          throw new Error(
            `No active Eloquent request context for ${operation}. Wrap database work inside Eloquent.hyperdrive(). Lazy-loading relationships outside that scope is not supported in Workers.`
          );
        }
        if (context.released) {
          throw new Error(
            `The active Eloquent Hyperdrive request context has already been released for ${operation}. Start a new Eloquent.hyperdrive() scope for additional queries.`
          );
        }
        return context;
      }
      static getMorphMap() {
        const context = _Eloquent.getContext();
        return context ? context.morphMap : _Eloquent.registeredMorphMap;
      }
      static runWithRequestContext(context, callback) {
        return _Eloquent.connectionStorage.run(context, callback);
      }
      static attachRequestContext(target, context) {
        Object.defineProperty(target, _Eloquent.requestContextSymbol, {
          value: context,
          enumerable: false,
          configurable: true,
          writable: true
        });
      }
      static detachRequestContext(target) {
        delete target[_Eloquent.requestContextSymbol];
      }
      static releaseRequestContext(context) {
        context.connection = null;
        context.connectionInitialization = null;
        context.hyperdrive = null;
        context.loadBatch.length = 0;
        context.loadingPromises.clear();
        context.collectionsRegistry.clear();
        context.batchFlushScheduled = false;
        context.released = true;
      }
      static buildMysqlConnectionOptions(binding, connectTimeout) {
        if (binding.host) {
          return {
            host: binding.host,
            user: binding.user,
            password: binding.password,
            database: _Eloquent.resolveBindingDatabase(binding),
            port: Number(binding.port) || 3306,
            disableEval: true,
            connectTimeout
          };
        }
        try {
          const url = new URL(binding.connectionString);
          if (url.protocol === "mysql:") {
            const database = _Eloquent.resolveBindingDatabase(binding);
            return {
              host: url.hostname,
              user: decodeURIComponent(url.username),
              password: decodeURIComponent(url.password),
              database,
              port: Number(url.port) || 3306,
              disableEval: true,
              connectTimeout
            };
          }
        } catch {
        }
        return { uri: binding.connectionString, disableEval: true, connectTimeout };
      }
      /**
       * Get the active database connection.
       * Workers-only: create the request-scoped Hyperdrive connection lazily on first use.
       */
      static async resolveConnection() {
        const context = _Eloquent.requireContext("query execution");
        if (context.connection) {
          return context.connection;
        }
        if (context.connectionInitialization) {
          return await context.connectionInitialization;
        }
        if (!context.hyperdrive) {
          throw new Error(
            "No Hyperdrive binding is available in the active Eloquent request context. Wrap database work inside Eloquent.hyperdrive()."
          );
        }
        let initialization;
        initialization = (async () => {
          const { binding, connectTimeout } = context.hyperdrive;
          const connection = await _Eloquent.connectionFactory(
            _Eloquent.buildMysqlConnectionOptions(binding, connectTimeout)
          );
          if (context.released) {
            throw new Error(
              "The active Eloquent Hyperdrive request context was released before the database client finished initializing. Start a new Eloquent.hyperdrive() scope for additional queries."
            );
          }
          context.connection = connection;
          return connection;
        })();
        context.connectionInitialization = initialization;
        try {
          return await initialization;
        } finally {
          if (context.connectionInitialization === initialization) {
            context.connectionInitialization = null;
          }
        }
      }
      /**
       * Manual connections are not supported in the Workers-only runtime.
       */
      static async withConnection(connection, callback, options) {
        void connection;
        void callback;
        void options;
        throw new Error(
          "Eloquent.withConnection() is not supported in the Workers-only runtime. Wrap queries inside Eloquent.hyperdrive() instead."
        );
      }
      /**
       * Run a callback in a Workers-native Hyperdrive request scope.
       *
       * The mysql2 client is created lazily on the first actual query inside the callback,
       * reused for the rest of that request scope, and then released naturally with the
       * Worker request lifecycle. We intentionally do not call connection.end().
       *
       * Usage:
       *   const result = await Eloquent.hyperdrive(env.BACKEND_DB, MODEL_MAPPINGS, async () => {
       *     return await handler.execute(...);
       *   });
       */
      static async hyperdrive(binding, morphs, callback, options) {
        const resolvedOptions = _Eloquent.resolveOptions(options);
        const context = _Eloquent.createRequestContext({
          morphs,
          eloquentOptions: resolvedOptions,
          hyperdrive: {
            binding,
            connectTimeout: resolvedOptions.connectTimeout,
            database: _Eloquent.resolveBindingDatabase(binding)
          }
        });
        return await _Eloquent.runWithRequestContext(context, async () => {
          try {
            return await callback();
          } finally {
            _Eloquent.releaseRequestContext(context);
          }
        });
      }
      /**
       * Hono middleware that registers a request-scoped Hyperdrive context for downstream ORM queries.
       * The request-scoped mysql2 connection is destroyed when the downstream middleware/handler finishes.
       */
      static honoMiddleware(resolveBinding, morphs, options) {
        return async (context, next) => {
          const resolvedOptions = _Eloquent.resolveOptions(options);
          const binding = resolveBinding(context);
          const requestContext = _Eloquent.createRequestContext({
            morphs,
            eloquentOptions: resolvedOptions,
            hyperdrive: {
              binding,
              connectTimeout: resolvedOptions.connectTimeout,
              database: _Eloquent.resolveBindingDatabase(binding)
            }
          });
          _Eloquent.attachRequestContext(context, requestContext);
          try {
            await _Eloquent.runWithRequestContext(requestContext, async () => {
              await next();
            });
          } finally {
            if (requestContext.connection && typeof requestContext.connection.destroy === "function") {
              requestContext.connection.destroy();
            }
            _Eloquent.releaseRequestContext(requestContext);
            _Eloquent.detachRequestContext(context);
          }
        };
      }
      /**
       * Check if this model uses Sushi (in-memory array data)
       * Override this method to return true for API-based Sushi models
       */
      static usesSushi() {
        if (Array.isArray(this.rows)) {
          return true;
        }
        const hasOwnGetRows = Object.prototype.hasOwnProperty.call(this, "getRows") || this.getRows !== _Eloquent.getRows;
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
        _Eloquent.requireContext("automatic relationship loading").automaticallyEagerLoadRelationshipsEnabled = true;
      }
      static isAutomaticallyEagerLoadRelationshipsEnabled() {
        var _a;
        return ((_a = _Eloquent.getContext()) == null ? void 0 : _a.automaticallyEagerLoadRelationshipsEnabled) ?? false;
      }
      static enableDebug(logger) {
        _Eloquent.debugEnabled = true;
        if (logger) {
          _Eloquent.debugLogger = logger;
        }
      }
      static disableDebug() {
        _Eloquent.debugEnabled = false;
      }
      static raw(value) {
        return value;
      }
      // Batching system for loadForAll
      static getLoadBatch() {
        return _Eloquent.requireContext("load batching").loadBatch;
      }
      // Get the loading promises cache
      static getLoadingPromises() {
        return _Eloquent.requireContext("relation loading").loadingPromises;
      }
      // Generate a cache key for a loading operation
      static getLoadingCacheKey(modelName, instanceIds, relationNames) {
        const sortedIds = [...instanceIds].sort();
        const sortedRelations = [...relationNames].sort();
        return `${modelName}:${sortedIds.join(",")}:${sortedRelations.join(",")}`;
      }
      // Get the collections registry
      static getCollectionsRegistry() {
        return _Eloquent.requireContext("collection tracking").collectionsRegistry;
      }
      // Generate a unique collection ID
      static generateCollectionId() {
        return `collection_${++COLLECTION_ID_COUNTER}_${Date.now()}`;
      }
      static addToLoadBatch(instances, relations) {
        const batch = this.getLoadBatch();
        const existingItem = batch.find((item) => {
          if (item.instances.length !== instances.length) return false;
          const itemIds = item.instances.map((inst) => inst.id || inst).sort();
          const instancesIds = instances.map((inst) => inst.id || inst).sort();
          if (itemIds.join(",") !== instancesIds.join(",")) return false;
          return JSON.stringify(item.relations) === JSON.stringify(relations);
        });
        if (!existingItem) {
          batch.push({ instances, relations });
        }
        this.scheduleBatchFlush();
      }
      static scheduleBatchFlush() {
        const context = _Eloquent.requireContext("load batching");
        if (context.batchFlushScheduled) {
          return;
        }
        context.batchFlushScheduled = true;
        const flushBatch = async () => {
          try {
            await _Eloquent.runWithRequestContext(context, async () => {
              if (context.released || context.loadBatch.length === 0) {
                return;
              }
              if (context.loadBatch.length > 0) {
                await this.flushLoadBatch();
              }
            });
          } finally {
            context.batchFlushScheduled = false;
          }
        };
        if (typeof queueMicrotask === "function") {
          queueMicrotask(() => {
            void flushBatch();
          });
        } else {
          Promise.resolve().then(() => {
            void flushBatch();
          });
        }
      }
      static async flushLoadBatch() {
        const batch = this.getLoadBatch();
        if (batch.length === 0) return;
        this.getLoadBatch().length = 0;
        const instanceGroups = /* @__PURE__ */ new Map();
        for (const item of batch) {
          const key = item.instances.map((inst) => inst.id || inst).sort().join(",");
          if (!instanceGroups.has(key)) {
            instanceGroups.set(key, { instances: item.instances, relations: /* @__PURE__ */ new Set() });
          }
          const group = instanceGroups.get(key);
          if (typeof item.relations === "string") {
            group.relations.add(item.relations);
          } else if (Array.isArray(item.relations)) {
            item.relations.forEach((rel) => group.relations.add(rel));
          } else {
            Object.keys(item.relations).forEach((rel) => group.relations.add(rel));
          }
        }
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
        const context = _Eloquent.getContext();
        if (!context) return;
        context.loadBatch.length = 0;
        context.batchFlushScheduled = false;
      }
      static async init(connection, morphs) {
        void connection;
        void morphs;
        throw new Error(
          "Eloquent.init() is not supported in the Workers-only runtime. Wrap queries inside Eloquent.hyperdrive() instead."
        );
      }
      static useConnection(connection, morphs) {
        void connection;
        void morphs;
        throw new Error(
          "Eloquent.useConnection() is not supported in the Workers-only runtime. Wrap queries inside Eloquent.hyperdrive() instead."
        );
      }
      // Infer relation config from instance relation methods (Laravel-style),
      // falling back to optional static relations map if present.
      static getRelationConfig(model, relationName) {
        const staticMap = model.relations && model.relations[relationName];
        if (staticMap) return staticMap;
        try {
          const proto = model.prototype;
          const relationFn = proto && proto[relationName];
          if (typeof relationFn === "function") {
            const fakeInstance = Object.create(proto);
            fakeInstance.id = 0;
            const result = relationFn.call(fakeInstance);
            if (result && result instanceof Relation) {
              return result.getConfig();
            }
          }
        } catch {
        }
        return _Eloquent.describeRelation(model, relationName);
      }
      static describeRelation(model, relationName) {
        const proto = model.prototype;
        const relationFn = proto && proto[relationName];
        if (typeof relationFn !== "function") return null;
        if (relationName === "constructor") return null;
        const makeStub = (meta) => {
          const target = { __relation: meta };
          let proxy;
          proxy = new Proxy(target, {
            get(t, prop) {
              if (prop in t) return t[prop];
              return (..._args) => proxy;
            }
          });
          return proxy;
        };
        const fake = Object.create(proto);
        fake.belongsTo = (related, foreignKey, ownerKey = "id") => {
          const resolvedRelated = typeof related === "string" ? related : related;
          return makeStub({ type: "belongsTo", model: resolvedRelated, foreignKey, ownerKey });
        };
        fake.hasMany = (related, foreignKey, localKey = "id") => {
          const resolvedRelated = typeof related === "string" ? related : related;
          return makeStub({ type: "hasMany", model: resolvedRelated, foreignKey, localKey });
        };
        fake.hasOne = (related, foreignKey, localKey = "id") => {
          const resolvedRelated = typeof related === "string" ? related : related;
          return makeStub({ type: "hasOne", model: resolvedRelated, foreignKey, localKey });
        };
        fake.morphOne = (related, name, typeColumn, idColumn, localKey = "id") => {
          const resolvedRelated = typeof related === "string" ? related : related;
          return makeStub({ type: "morphOne", model: resolvedRelated, morphName: name, typeColumn, idColumn, localKey });
        };
        fake.morphMany = (related, name, typeColumn, idColumn, localKey = "id") => {
          const resolvedRelated = typeof related === "string" ? related : related;
          return makeStub({ type: "morphMany", model: resolvedRelated, morphName: name, typeColumn, idColumn, localKey });
        };
        fake.morphOneOfMany = (related, name, column = "created_at", aggregate = "max", typeColumn, idColumn, localKey = "id") => {
          const resolvedRelated = typeof related === "string" ? related : related;
          return makeStub({ type: "morphOneOfMany", model: resolvedRelated, morphName: name, column, aggregate, typeColumn, idColumn, localKey });
        };
        fake.latestMorphOne = (related, name, column = "created_at", typeColumn, idColumn, localKey = "id") => {
          const resolvedRelated = typeof related === "string" ? related : related;
          return makeStub({ type: "morphOneOfMany", model: resolvedRelated, morphName: name, column, aggregate: "max", typeColumn, idColumn, localKey });
        };
        fake.oldestMorphOne = (related, name, column = "created_at", typeColumn, idColumn, localKey = "id") => {
          const resolvedRelated = typeof related === "string" ? related : related;
          return makeStub({ type: "morphOneOfMany", model: resolvedRelated, morphName: name, column, aggregate: "min", typeColumn, idColumn, localKey });
        };
        fake.morphTo = (name, typeColumn, idColumn) => makeStub({ type: "morphTo", morphName: name, typeColumn, idColumn });
        fake.belongsToMany = (related, table, foreignPivotKey, relatedPivotKey, parentKey = "id", relatedKey = "id") => {
          const resolvedRelated = typeof related === "string" ? related : related;
          return makeStub({ type: "belongsToMany", model: resolvedRelated, table, foreignPivotKey, relatedPivotKey, parentKey, relatedKey });
        };
        let result;
        try {
          result = relationFn.call(fake);
        } catch {
          return null;
        }
        if (result && typeof result === "object" && "__relation" in result) {
          return result.__relation;
        }
        return null;
      }
      belongsTo(related, foreignKey, ownerKey = "id") {
        if (typeof related === "string") {
          const ModelClass = _Eloquent.getModelForMorphType(related);
          if (!ModelClass) {
            throw new Error(`Model '${related}' not found in morph map`);
          }
          return new BelongsTo(this, ModelClass, foreignKey, ownerKey);
        } else {
          return new BelongsTo(this, related, foreignKey, ownerKey);
        }
      }
      hasMany(related, foreignKey, localKey = "id") {
        if (typeof related === "string") {
          const ModelClass = _Eloquent.getModelForMorphType(related);
          if (!ModelClass) {
            throw new Error(`Model '${related}' not found in morph map`);
          }
          return new HasMany(this, ModelClass, foreignKey, localKey);
        } else {
          return new HasMany(this, related, foreignKey, localKey);
        }
      }
      hasOne(related, foreignKey, localKey = "id") {
        if (typeof related === "string") {
          const ModelClass = _Eloquent.getModelForMorphType(related);
          if (!ModelClass) {
            throw new Error(`Model '${related}' not found in morph map`);
          }
          return new HasOne(this, ModelClass, foreignKey, localKey);
        } else {
          return new HasOne(this, related, foreignKey, localKey);
        }
      }
      hasOneOfMany(related, foreignKey, column = "created_at", aggregate = "max", localKey = "id") {
        if (typeof related === "string") {
          const ModelClass = _Eloquent.getModelForMorphType(related);
          if (!ModelClass) {
            throw new Error(`Model '${related}' not found in morph map`);
          }
          return ModelClass.query().where(foreignKey, this[localKey]).ofMany(column, aggregate);
        } else {
          return related.query().where(foreignKey, this[localKey]).ofMany(column, aggregate);
        }
      }
      latestOfMany(related, foreignKey, column = "created_at", localKey = "id") {
        return this.hasOneOfMany(related, foreignKey, column, "max", localKey);
      }
      oldestOfMany(related, foreignKey, column = "created_at", localKey = "id") {
        return this.hasOneOfMany(related, foreignKey, column, "min", localKey);
      }
      morphOne(related, name, typeColumn, idColumn, localKey = "id") {
        if (typeof related === "string") {
          const ModelClass = _Eloquent.getModelForMorphType(related);
          if (!ModelClass) {
            throw new Error(`Model '${related}' not found in morph map`);
          }
          return new MorphOne(this, ModelClass, name, typeColumn, idColumn, localKey);
        } else {
          return new MorphOne(this, related, name, typeColumn, idColumn, localKey);
        }
      }
      morphOneOfMany(related, name, column = "created_at", aggregate = "max", typeColumn, idColumn, localKey = "id") {
        if (typeof related === "string") {
          const ModelClass = _Eloquent.getModelForMorphType(related);
          if (!ModelClass) {
            throw new Error(`Model '${related}' not found in morph map`);
          }
          return new MorphOneOfMany(this, ModelClass, name, column, aggregate, typeColumn, idColumn, localKey);
        } else {
          return new MorphOneOfMany(this, related, name, column, aggregate, typeColumn, idColumn, localKey);
        }
      }
      latestMorphOne(related, name, column = "created_at", typeColumn, idColumn, localKey = "id") {
        return this.morphOneOfMany(related, name, column, "max", typeColumn, idColumn, localKey);
      }
      oldestMorphOne(related, name, column = "created_at", typeColumn, idColumn, localKey = "id") {
        return this.morphOneOfMany(related, name, column, "min", typeColumn, idColumn, localKey);
      }
      morphMany(related, name, typeColumn, idColumn, localKey = "id") {
        if (typeof related === "string") {
          const ModelClass = _Eloquent.getModelForMorphType(related);
          if (!ModelClass) {
            throw new Error(`Model '${related}' not found in morph map`);
          }
          return new MorphMany(this, ModelClass, name, typeColumn, idColumn, localKey);
        } else {
          return new MorphMany(this, related, name, typeColumn, idColumn, localKey);
        }
      }
      morphTo(name, typeColumn, idColumn) {
        return new MorphTo(this, name, typeColumn, idColumn);
      }
      static registerMorphMap(map) {
        _Eloquent.registeredMorphMap = { ..._Eloquent.registeredMorphMap, ...map };
        const context = _Eloquent.getContext();
        if (context) {
          context.morphMap = { ...context.morphMap, ...map };
        }
      }
      static getMorphTypeForModel(model) {
        const explicit = model.morphClass;
        if (explicit) return explicit;
        for (const [alias, ctor] of Object.entries(_Eloquent.getMorphMap())) {
          if (ctor === model) return alias;
        }
        return model.name;
      }
      static getModelForMorphType(type) {
        if (!type) return null;
        const morphMap = _Eloquent.getMorphMap();
        if (morphMap[type]) return morphMap[type];
        for (const [key, modelClass] of Object.entries(morphMap)) {
          if (key === type || modelClass.morphClass === type) {
            return modelClass;
          }
        }
        return null;
      }
      static getPossibleMorphTypesForModel(model) {
        const set = /* @__PURE__ */ new Set();
        const explicitTypes = model.morphTypes;
        const explicitClass = model.morphClass;
        if (explicitTypes && Array.isArray(explicitTypes)) {
          for (const t of explicitTypes) if (t) set.add(t);
        }
        if (explicitClass) set.add(explicitClass);
        for (const [alias, ctor] of Object.entries(_Eloquent.getMorphMap())) {
          if (ctor === model) set.add(alias);
        }
        const className = model.name;
        set.add(className);
        return Array.from(set);
      }
      hasOneThrough(related, through, firstKey, secondKey, localKey = "id", secondLocalKey = "id") {
        const ResolvedRelated = typeof related === "string" ? _Eloquent.getModelForMorphType(related) : related;
        const ResolvedThrough = typeof through === "string" ? _Eloquent.getModelForMorphType(through) : through;
        if (!ResolvedRelated || !ResolvedThrough) {
          throw new Error(`Models '${related}' or '${through}' not found in morph map`);
        }
        return new HasOneThrough(this, ResolvedRelated, ResolvedThrough, firstKey, secondKey, localKey, secondLocalKey);
      }
      hasManyThrough(related, through, firstKey, secondKey, localKey = "id", secondLocalKey = "id") {
        const ResolvedRelated = typeof related === "string" ? _Eloquent.getModelForMorphType(related) : related;
        const ResolvedThrough = typeof through === "string" ? _Eloquent.getModelForMorphType(through) : through;
        if (!ResolvedRelated || !ResolvedThrough) {
          throw new Error(`Models '${related}' or '${through}' not found in morph map`);
        }
        return new HasManyThrough(this, ResolvedRelated, ResolvedThrough, firstKey, secondKey, localKey, secondLocalKey);
      }
      belongsToMany(related, table, foreignPivotKey, relatedPivotKey, parentKey = "id", relatedKey = "id") {
        if (typeof related === "string") {
          const ModelClass = _Eloquent.getModelForMorphType(related);
          if (!ModelClass) {
            throw new Error(`Model '${related}' not found in morph map`);
          }
          return new BelongsToMany(this, ModelClass, table, foreignPivotKey, relatedPivotKey, parentKey, relatedKey);
        } else {
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
        const defaultWith = this.with;
        if (defaultWith && Array.isArray(defaultWith) && defaultWith.length > 0) {
          qb.with(defaultWith);
        }
        return qb;
      }
      toJSON() {
        const hidden = this.constructor.hidden || [];
        const appends = this.constructor.appends || [];
        const out = {};
        for (const key of Object.keys(this)) {
          if (hidden.includes(key)) continue;
          out[key] = this[key];
        }
        for (const key of appends) {
          if (hidden.includes(key)) continue;
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
        const relations = args.length > 1 ? args : args[0];
        const collection = this.__collection;
        const collectionId = this.__collectionId;
        const modelName = this.constructor.name;
        const instanceId = this.id;
        const relationNames = this.constructor.parseRelationNames(relations);
        const fullRelationNames = this.constructor.parseFullRelationNames(relations);
        let alreadyLoaded = false;
        let targets = [this];
        if (collectionId) {
          const collectionsRegistry = _Eloquent.getCollectionsRegistry();
          const registeredCollection = collectionsRegistry.get(collectionId);
          if (registeredCollection && registeredCollection.length > 0) {
            targets = registeredCollection;
          }
        } else if (collection && collection.length) {
          targets = collection;
        }
        if (targets.length > 1) {
          const firstTarget = targets[0];
          alreadyLoaded = relationNames.every((name) => {
            const rel = firstTarget.__relations || {};
            return name in rel;
          });
        } else {
          const rels = this.__relations || {};
          alreadyLoaded = relationNames.every((name) => name in rels);
        }
        if (_Eloquent.debugEnabled) {
          const targetCount = targets.length;
          const instanceId2 = this.id || "unknown";
          if (alreadyLoaded) {
            _Eloquent.debugLogger(`loadForAll: Using cached data for relations [${fullRelationNames.join(", ")}] on ${this.constructor.name}#${instanceId2} (${targetCount} instances in collection)`);
          } else {
            _Eloquent.debugLogger(`loadForAll: Making fresh DB call for relations [${fullRelationNames.join(", ")}] on ${this.constructor.name}#${instanceId2} (loading for ${targetCount} instances)`);
          }
        }
        if (!alreadyLoaded) {
          const targetIds = targets.map((t) => t.id).filter((id) => id !== void 0);
          const cacheKey = collectionId ? `${collectionId}:${fullRelationNames.sort().join(",")}` : instanceId !== void 0 ? _Eloquent.getLoadingCacheKey(modelName, [instanceId], fullRelationNames) : null;
          const loadingPromises = _Eloquent.getLoadingPromises();
          if (cacheKey && loadingPromises.has(cacheKey)) {
            if (_Eloquent.debugEnabled) {
              _Eloquent.debugLogger(`loadForAll: Waiting for concurrent load operation for relations [${fullRelationNames.join(", ")}] on ${this.constructor.name}#${instanceId}`);
            }
            await loadingPromises.get(cacheKey);
          } else if (cacheKey) {
            const loadPromise = (async () => {
              try {
                if (_Eloquent.debugEnabled) {
                  _Eloquent.debugLogger(`loadForAll: Starting DB load for relations [${fullRelationNames.join(", ")}] on ${this.constructor.name} (${targetIds.length} instances)`);
                }
                await this.constructor.load(targets, relations);
              } finally {
                loadingPromises.delete(cacheKey);
              }
            })();
            loadingPromises.set(cacheKey, loadPromise);
            await loadPromise;
          } else {
            await this.constructor.load(targets, relations);
          }
        }
        return this;
      }
      static async load(instances, relations) {
        if (instances.length === 0) return;
        const model = instances[0].constructor;
        const qb = model.query();
        qb.with(relations);
        const ids = instances.map((inst) => inst.id).filter((id) => id !== null && id !== void 0);
        if (ids.length === 0) return;
        const loadedInstances = await model.query().with(relations).whereIn("id", ids).get();
        const loadedMap = new Map(loadedInstances.map((inst) => [inst.id, inst]));
        const names = this.parseRelationNames(relations);
        for (const instance of instances) {
          const loaded = loadedMap.get(instance.id);
          if (!loaded) continue;
          for (const name of names) {
            if (loaded[name] !== void 0) {
              instance[name] = loaded[name];
              try {
                const holder = instance.__relations || {};
                if (!instance.__relations) {
                  Object.defineProperty(instance, "__relations", { value: holder, enumerable: false, configurable: true, writable: true });
                }
                holder[name] = true;
              } catch {
              }
            }
          }
        }
      }
      static async loadMissing(instances, relations) {
        if (instances.length === 0) return;
        const relationNames = this.parseRelationNames(relations);
        const instancesToLoad = instances.filter((inst) => {
          const rels = inst.__relations || {};
          return relationNames.some((name) => !(name in rels));
        });
        if (instancesToLoad.length === 0) return;
        await this.load(instancesToLoad, relations);
      }
      static async loadCount(instances, relations) {
        if (instances.length === 0) return;
        const model = instances[0].constructor;
        const qb = model.query();
        qb.withCount(relations);
        const ids = instances.map((inst) => inst.id).filter((id) => id !== null && id !== void 0);
        if (ids.length === 0) return;
        const loadedInstances = await model.query().withCount(relations).whereIn("id", ids).get();
        const loadedMap = new Map(loadedInstances.map((inst) => [inst.id, inst]));
        const relationNames = this.parseRelationNames(relations);
        for (const instance of instances) {
          const loaded = loadedMap.get(instance.id);
          if (!loaded) continue;
          for (const name of relationNames) {
            const countProp = `${name}_count`;
            if (loaded[countProp] !== void 0) {
              instance[countProp] = loaded[countProp];
            }
          }
        }
      }
      static parseRelationNames(relations) {
        if (typeof relations === "string") {
          const base = relations.split(":")[0];
          return [base.split(".")[0]];
        } else if (Array.isArray(relations)) {
          return relations.map((r) => r.split(":")[0]).map((n) => n.split(".")[0]);
        } else if (relations && typeof relations === "object") {
          return Object.keys(relations).map((n) => n.split(".")[0]);
        }
        return [];
      }
      // Parse full relation names including nested paths (e.g., 'business.owner' stays as 'business.owner')
      static parseFullRelationNames(relations) {
        if (typeof relations === "string") {
          return [relations.split(":")[0]];
        } else if (Array.isArray(relations)) {
          return relations.map((r) => r.split(":")[0]);
        } else if (relations && typeof relations === "object") {
          const result = [];
          for (const key of Object.keys(relations)) {
            result.push(key);
            const value = relations[key];
            if (Array.isArray(value)) {
              value.forEach((nested) => {
                result.push(`${key}.${nested}`);
              });
            }
          }
          return result;
        }
        return [];
      }
    };
    _Eloquent.hidden = [];
    _Eloquent.appends = [];
    _Eloquent.with = [];
    _Eloquent.options = {
      connectTimeout: 1e4,
      prefixTablesWithDatabase: false
    };
    _Eloquent.connectionStorage = new import_node_async_hooks.AsyncLocalStorage();
    _Eloquent.connectionFactory = import_promise.createConnection;
    _Eloquent.registeredMorphMap = {};
    _Eloquent.requestContextSymbol = /* @__PURE__ */ Symbol.for("eloquent.requestContext");
    // Debug logging
    _Eloquent.debugEnabled = false;
    _Eloquent.debugLogger = (message, data) => {
      console.log(`[Eloquent Debug] ${message}`, data || "");
    };
    Eloquent = _Eloquent;
    Eloquent_default = Eloquent;
  }
});

// src/index.ts
var index_exports = {};
__export(index_exports, {
  BelongsTo: () => BelongsTo,
  BelongsToMany: () => BelongsToMany,
  Eloquent: () => Eloquent_default,
  HasMany: () => HasMany,
  HasManyThrough: () => HasManyThrough,
  HasOne: () => HasOne,
  HasOneThrough: () => HasOneThrough,
  MorphMany: () => MorphMany,
  MorphOne: () => MorphOne,
  MorphOneOfMany: () => MorphOneOfMany,
  MorphTo: () => MorphTo,
  Relation: () => Relation,
  default: () => Eloquent_default
});
module.exports = __toCommonJS(index_exports);
init_Eloquent();
init_Eloquent();
init_relations();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BelongsTo,
  BelongsToMany,
  Eloquent,
  HasMany,
  HasManyThrough,
  HasOne,
  HasOneThrough,
  MorphMany,
  MorphOne,
  MorphOneOfMany,
  MorphTo,
  Relation
});
//# sourceMappingURL=index.cjs.map