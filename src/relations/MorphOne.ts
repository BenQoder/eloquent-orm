/**
 * MorphOne Relation Class
 *
 * Represents a polymorphic one-to-one relationship.
 * Example: Post morphOne Image (images table has imageable_type and imageable_id)
 */

import type Eloquent from '../Eloquent';
import { Relation, type RelationshipConfig } from './Relation';

/**
 * Base class for morph-one type relationships
 */
export abstract class MorphOneBase<TRelated extends Eloquent = Eloquent> extends Relation<TRelated> {
  protected typeColumn: string;
  protected idColumn: string;

  constructor(
    parent: Eloquent,
    related: typeof Eloquent,
    protected morphName: string,
    typeColumn?: string,
    idColumn?: string,
    protected localKey: string = 'id',
  ) {
    // Set columns before calling super (which calls addConstraints)
    const tCol = typeColumn || `${morphName}_type`;
    const iCol = idColumn || `${morphName}_id`;

    // Temporarily store these so addConstraints can use them
    (parent as any).__tempTypeColumn = tCol;
    (parent as any).__tempIdColumn = iCol;

    super(parent, related);

    this.typeColumn = tCol;
    this.idColumn = iCol;

    // Clean up temp properties
    delete (parent as any).__tempTypeColumn;
    delete (parent as any).__tempIdColumn;
  }

  /**
   * Add the base constraints - filter by morph type and id
   */
  protected addConstraints(): void {
    const typeColumn = (this.parent as any).__tempTypeColumn || this.typeColumn;
    const idColumn = (this.parent as any).__tempIdColumn || this.idColumn;

    const parentKey = (this.parent as any)[this.localKey];
    const morphTypes = this.getMorphTypes();

    if (parentKey !== null && parentKey !== undefined) {
      this.query.whereIn(typeColumn, morphTypes);
      this.query.where(idColumn, parentKey);
    }
  }

  /**
   * Get the related model's table name
   */
  protected getRelatedTable(): string {
    return (this.related as any).table || this.related.name.toLowerCase() + 's';
  }

  /**
   * Get possible morph type values for the parent model
   */
  protected getMorphTypes(): string[] {
    const parentClass = this.parent.constructor as typeof Eloquent;
    const types = new Set<string>();

    // Check for explicit morphClass
    const explicitClass = (parentClass as any).morphClass as string | undefined;
    if (explicitClass) types.add(explicitClass);

    // Check for explicit morphTypes array
    const explicitTypes = (parentClass as any).morphTypes as string[] | undefined;
    if (explicitTypes && Array.isArray(explicitTypes)) {
      for (const t of explicitTypes) if (t) types.add(t);
    }

    // Add class name as fallback
    types.add(parentClass.name);

    return Array.from(types);
  }
}

export class MorphOne<TRelated extends Eloquent = Eloquent> extends MorphOneBase<TRelated> {
  public readonly type = 'morphOne';

  /**
   * Get the relationship configuration for eager loading
   */
  public getConfig(): RelationshipConfig {
    return {
      type: 'morphOne',
      model: this.related,
      morphName: this.morphName,
      typeColumn: this.typeColumn,
      idColumn: this.idColumn,
      localKey: this.localKey,
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
