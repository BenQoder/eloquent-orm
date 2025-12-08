export { default as Eloquent } from './Eloquent';

// Export Relation classes
export {
    Relation,
    HasMany,
    HasOne,
    BelongsTo,
    BelongsToMany,
    MorphMany,
    MorphOne,
    MorphTo,
    MorphOneOfMany,
    HasManyThrough,
    HasOneThrough,
    type RelationshipConfig,
} from './relations';
