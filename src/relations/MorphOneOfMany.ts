/**
 * MorphOneOfMany Relation Class
 *
 * Represents a polymorphic one-of-many relationship with aggregation.
 * Used for latestMorphOne and oldestMorphOne patterns.
 * Example: Post latestMorphOne Status (get the most recent status)
 */

import type Eloquent from '../Eloquent';
import { MorphOneBase } from './MorphOne';
import type { RelationshipConfig } from './Relation';

export class MorphOneOfMany<TRelated extends Eloquent = Eloquent> extends MorphOneBase<TRelated> {
  public readonly type = 'morphOneOfMany';

  constructor(
    parent: Eloquent,
    related: typeof Eloquent,
    morphName: string,
    protected column: string = 'created_at',
    protected aggregate: 'min' | 'max' = 'max',
    typeColumn?: string,
    idColumn?: string,
    localKey: string = 'id',
  ) {
    super(parent, related, morphName, typeColumn, idColumn, localKey);
  }

  /**
   * Add the base constraints - filter by morph type/id and aggregate
   */
  protected addConstraints(): void {
    // Call parent constraints first
    super.addConstraints();

    // Add the aggregate constraint
    const parentKey = (this.parent as any)[this.localKey];
    if (parentKey !== null && parentKey !== undefined) {
      const relatedTable = this.getRelatedTable();
      const aggFn = this.aggregate === 'max' ? 'MAX' : 'MIN';

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
  public getConfig(): RelationshipConfig {
    return {
      type: 'morphOneOfMany',
      model: this.related,
      morphName: this.morphName,
      typeColumn: this.typeColumn,
      idColumn: this.idColumn,
      localKey: this.localKey,
      column: this.column,
      aggregate: this.aggregate,
    };
  }

  /**
   * Get the results of the relationship (single record or null)
   */
  public async getResults(): Promise<TRelated | null> {
    const parentKey = (this.parent as any)[this.localKey];
    if (parentKey === null || parentKey === undefined) {
      return null;
    }
    return this.first();
  }
}

/**
 * Factory function for creating a "latest" morph one relationship
 */
export function latestMorphOne<TRelated extends Eloquent = Eloquent>(
  parent: Eloquent,
  related: typeof Eloquent,
  morphName: string,
  column: string = 'created_at',
  typeColumn?: string,
  idColumn?: string,
  localKey: string = 'id',
): MorphOneOfMany<TRelated> {
  return new MorphOneOfMany<TRelated>(
    parent,
    related,
    morphName,
    column,
    'max',
    typeColumn,
    idColumn,
    localKey,
  );
}

/**
 * Factory function for creating an "oldest" morph one relationship
 */
export function oldestMorphOne<TRelated extends Eloquent = Eloquent>(
  parent: Eloquent,
  related: typeof Eloquent,
  morphName: string,
  column: string = 'created_at',
  typeColumn?: string,
  idColumn?: string,
  localKey: string = 'id',
): MorphOneOfMany<TRelated> {
  return new MorphOneOfMany<TRelated>(
    parent,
    related,
    morphName,
    column,
    'min',
    typeColumn,
    idColumn,
    localKey,
  );
}
