/**
 * MorphMany Relation Class
 *
 * Represents a polymorphic one-to-many relationship.
 * Example: Post morphMany Comments (comments table has commentable_type and commentable_id)
 */

import type Eloquent from '../Eloquent';
import { type Collection } from '../Eloquent';
import { Relation, type RelationshipConfig } from './Relation';

export class MorphMany<TRelated extends Eloquent = Eloquent> extends Relation<TRelated> {
  public readonly type = 'morphMany';
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
   * Get the relationship configuration for eager loading
   */
  public getConfig(): RelationshipConfig {
    return {
      type: 'morphMany',
      model: this.related,
      morphName: this.morphName,
      typeColumn: this.typeColumn,
      idColumn: this.idColumn,
      localKey: this.localKey,
    };
  }

  /**
   * Get the results of the relationship
   */
  public async getResults(): Promise<TRelated[]> {
    const parentKey = (this.parent as any)[this.localKey];
    if (parentKey === null || parentKey === undefined) {
      return [];
    }
    return this.get() as unknown as Promise<TRelated[]>;
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
