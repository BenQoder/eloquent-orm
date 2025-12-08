/**
 * BelongsToMany Relation Class
 *
 * Represents a many-to-many relationship through a pivot table.
 * Example: User belongsToMany Roles (through user_roles pivot table)
 */

import type Eloquent from '../Eloquent';
import { type Collection } from '../Eloquent';
import { Relation, type RelationshipConfig } from './Relation';

export class BelongsToMany<TRelated extends Eloquent = Eloquent> extends Relation<TRelated> {
  public readonly type = 'belongsToMany';
  protected pivotColumns: string[] = [];
  protected table?: string;
  protected foreignPivotKey?: string;
  protected relatedPivotKey?: string;
  protected parentKey: string;
  protected relatedKey: string;

  constructor(
    parent: Eloquent,
    related: typeof Eloquent,
    table?: string,
    foreignPivotKey?: string,
    relatedPivotKey?: string,
    parentKey: string = 'id',
    relatedKey: string = 'id',
  ) {
    // Store properties BEFORE calling super (which calls addConstraints)
    (parent as any).__tempTable = table;
    (parent as any).__tempForeignPivotKey = foreignPivotKey;
    (parent as any).__tempRelatedPivotKey = relatedPivotKey;
    (parent as any).__tempParentKey = parentKey;
    (parent as any).__tempRelatedKey = relatedKey;

    super(parent, related);

    this.table = table;
    this.foreignPivotKey = foreignPivotKey;
    this.relatedPivotKey = relatedPivotKey;
    this.parentKey = parentKey;
    this.relatedKey = relatedKey;

    // Clean up
    delete (parent as any).__tempTable;
    delete (parent as any).__tempForeignPivotKey;
    delete (parent as any).__tempRelatedPivotKey;
    delete (parent as any).__tempParentKey;
    delete (parent as any).__tempRelatedKey;
  }

  /**
   * Add the base constraints - join through pivot table
   */
  protected addConstraints(): void {
    const parentKey = (this.parent as any).__tempParentKey || this.parentKey || 'id';
    const parentKeyValue = (this.parent as any)[parentKey];
    if (parentKeyValue === null || parentKeyValue === undefined) {
      return;
    }

    const pivotTable = this.getPivotTable();
    const relatedTable = this.getRelatedTable();
    const fpk = this.getForeignPivotKey();
    const rpk = this.getRelatedPivotKey();
    const relatedKey = (this.parent as any).__tempRelatedKey || this.relatedKey || 'id';

    // Join through pivot table
    this.query
      .join(pivotTable, `${relatedTable}.${relatedKey}`, '=', `${pivotTable}.${rpk}`)
      .where(`${pivotTable}.${fpk}`, parentKeyValue);
  }

  /**
   * Get the relationship configuration for eager loading
   */
  public getConfig(): RelationshipConfig {
    return {
      type: 'belongsToMany',
      model: this.related,
      table: this.getPivotTable(),
      foreignPivotKey: this.getForeignPivotKey(),
      relatedPivotKey: this.getRelatedPivotKey(),
      parentKey: this.parentKey,
      relatedKey: this.relatedKey,
    };
  }

  /**
   * Get the results of the relationship
   */
  public async getResults(): Promise<TRelated[]> {
    const parentKeyValue = (this.parent as any)[this.parentKey];
    if (parentKeyValue === null || parentKeyValue === undefined) {
      return [];
    }
    return this.get() as unknown as Promise<TRelated[]>;
  }

  /**
   * Specify which pivot columns to include
   */
  withPivot(...columns: string[]): this {
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
  protected getPivotTable(): string {
    const table = (this.parent as any).__tempTable || this.table;
    if (table) return table;
    // Generate default pivot table name from model names (alphabetical order)
    const parentName = this.parent.constructor.name.toLowerCase();
    const relatedName = this.related.name.toLowerCase();
    return [parentName, relatedName].sort().join('_');
  }

  /**
   * Get the related model's table name
   */
  protected getRelatedTable(): string {
    return (this.related as any).table || this.related.name.toLowerCase() + 's';
  }

  /**
   * Get the foreign pivot key
   */
  protected getForeignPivotKey(): string {
    const fpk = (this.parent as any).__tempForeignPivotKey || this.foreignPivotKey;
    return fpk || `${this.parent.constructor.name.toLowerCase()}_id`;
  }

  /**
   * Get the related pivot key
   */
  protected getRelatedPivotKey(): string {
    const rpk = (this.parent as any).__tempRelatedPivotKey || this.relatedPivotKey;
    return rpk || `${this.related.name.toLowerCase()}_id`;
  }
}
