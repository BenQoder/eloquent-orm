# Sushi - In-Memory Array Data Source

Eloquent Sushi allows you to use in-memory arrays as a data source for your models, eliminating the need for a database connection. This is inspired by [Laravel's Sushi package](https://github.com/calebporzio/sushi).

## Table of Contents

- [Introduction](#introduction)
- [Basic Usage](#basic-usage)
- [Async Data Source (API)](#async-data-source-api)
- [Supported Query Methods](#supported-query-methods)
- [Accessors](#accessors)
- [Use Cases](#use-cases)
- [API Reference](#api-reference)

## Introduction

Sushi is perfect for:

- **Static reference data**: Countries, states, timezones, currencies
- **Configuration data**: Application settings, feature flags
- **API-backed models**: Fetch data from external APIs and query it like a database
- **Testing**: Mock data without needing a database connection
- **Prototyping**: Quickly prototype features before setting up a database

## Basic Usage

### Static Rows

Define your data directly in the model using the `rows` static property:

```typescript
import { Eloquent } from '@benqoder/eloquent-orm';

class Country extends Eloquent {
  protected static table = 'countries';

  // Define your data inline - no database needed!
  protected static rows = [
    { id: 1, code: 'US', name: 'United States', continent: 'North America', population: 331000000 },
    { id: 2, code: 'CA', name: 'Canada', continent: 'North America', population: 38000000 },
    { id: 3, code: 'GB', name: 'United Kingdom', continent: 'Europe', population: 67000000 },
    { id: 4, code: 'DE', name: 'Germany', continent: 'Europe', population: 83000000 },
    { id: 5, code: 'JP', name: 'Japan', continent: 'Asia', population: 126000000 },
  ];
}

// Query just like a database-backed model
const countries = await Country.query().get();
console.log(countries.length); // 5

const european = await Country.query()
  .where('continent', 'Europe')
  .orderBy('name')
  .get();
// Returns: Germany, United Kingdom

const us = await Country.query().where('code', 'US').first();
console.log(us.name); // "United States"
```

## Async Data Source (API)

Override the `getRows()` method to fetch data from any async source like an API:

```typescript
class ApiCountry extends Eloquent {
  protected static table = 'api_countries';

  // Override getRows to fetch from an API
  static async getRows(): Promise<Record<string, any>[]> {
    const response = await fetch('https://api.example.com/countries');
    const data = await response.json();
    return data.countries;
  }
}

// Query the API data using familiar Eloquent syntax
const countries = await ApiCountry.query()
  .where('population', '>', 100000000)
  .orderBy('name')
  .get();
```

### Caching API Data

For better performance, you can implement caching:

```typescript
class CachedApiCountry extends Eloquent {
  private static cache: Record<string, any>[] | null = null;
  private static cacheExpiry: number = 0;
  private static CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  static async getRows(): Promise<Record<string, any>[]> {
    const now = Date.now();

    if (this.cache && now < this.cacheExpiry) {
      return this.cache;
    }

    const response = await fetch('https://api.example.com/countries');
    const data = await response.json();

    this.cache = data.countries;
    this.cacheExpiry = now + this.CACHE_TTL;

    return this.cache;
  }

  // Optional: method to clear cache
  static clearCache() {
    this.cache = null;
    this.cacheExpiry = 0;
  }
}
```

## Supported Query Methods

Sushi supports most query methods available in the standard QueryBuilder:

### Filtering

```typescript
// Basic where
Country.query().where('code', 'US');
Country.query().where('population', '>', 100000000);
Country.query().where('name', '!=', 'Canada');

// Multiple conditions
Country.query()
  .where('continent', 'Europe')
  .where('population', '>', 50000000);

// Or conditions
Country.query()
  .where('code', 'US')
  .orWhere('code', 'CA');

// whereIn / whereNotIn
Country.query().whereIn('code', ['US', 'CA', 'MX']);
Country.query().whereNotIn('continent', ['Asia']);

// whereNull / whereNotNull
Setting.query().whereNull('deprecated_at');
Setting.query().whereNotNull('value');

// whereBetween
Country.query().whereBetween('population', [50000000, 150000000]);
```

### Ordering

```typescript
// Single order
Country.query().orderBy('name', 'asc');
Country.query().orderBy('population', 'desc');

// Multiple order columns
Country.query()
  .orderBy('continent', 'asc')
  .orderBy('name', 'asc');
```

### Limiting & Pagination

```typescript
// Limit results
Country.query().limit(5);

// Offset (skip)
Country.query().offset(10);

// Pagination style
Country.query().offset(20).limit(10); // Page 3 with 10 per page
```

### Column Selection

```typescript
// Select specific columns
Country.query().select('id', 'name', 'code');
```

### Aggregates

```typescript
// Count
const total = await Country.query().count();
const european = await Country.query().where('continent', 'Europe').count();

// Sum
const totalPop = await Country.query().sum('population');

// Average
const avgPop = await Country.query().avg('population');

// Min / Max
const minPop = await Country.query().min('population');
const maxPop = await Country.query().max('population');

// Exists
const hasUS = await Country.query().where('code', 'US').exists();
```

### Retrieval

```typescript
// Get all matching records
const countries = await Country.query().get();

// Get first matching record
const first = await Country.query().first();

// First or null
const country = await Country.query().where('code', 'XX').first(); // null
```

## Accessors

Sushi models support accessors just like database-backed models:

```typescript
class Country extends Eloquent {
  protected static rows = [
    { id: 1, code: 'US', name: 'United States', population: 331000000 },
    { id: 2, code: 'CN', name: 'China', population: 1400000000 },
  ];

  // Define an accessor
  getFormattedPopulationAttribute(): string {
    const pop = (this as any).population;
    if (pop >= 1000000000) {
      return `${(pop / 1000000000).toFixed(1)}B`;
    }
    return `${(pop / 1000000).toFixed(0)}M`;
  }
}

const china = await Country.query().where('code', 'CN').first();
console.log(china.formatted_population); // "1.4B"

const us = await Country.query().where('code', 'US').first();
console.log(us.formatted_population); // "331M"
```

## Use Cases

### 1. Static Reference Data

```typescript
class Timezone extends Eloquent {
  protected static rows = [
    { id: 1, name: 'America/New_York', offset: -5, label: 'Eastern Time' },
    { id: 2, name: 'America/Chicago', offset: -6, label: 'Central Time' },
    { id: 3, name: 'America/Denver', offset: -7, label: 'Mountain Time' },
    { id: 4, name: 'America/Los_Angeles', offset: -8, label: 'Pacific Time' },
    { id: 5, name: 'Europe/London', offset: 0, label: 'GMT' },
    { id: 6, name: 'Europe/Paris', offset: 1, label: 'Central European Time' },
  ];
}

// Use in a dropdown
const timezones = await Timezone.query().orderBy('offset').get();
```

### 2. Application Settings

```typescript
class Setting extends Eloquent {
  protected static rows = [
    { key: 'app_name', value: 'My App', type: 'string' },
    { key: 'debug_mode', value: 'false', type: 'boolean' },
    { key: 'max_upload_size', value: '10485760', type: 'integer' },
    { key: 'allowed_extensions', value: '["jpg","png","pdf"]', type: 'json' },
  ];

  getTypedValueAttribute(): any {
    const type = (this as any).type;
    const value = (this as any).value;

    switch (type) {
      case 'boolean': return value === 'true';
      case 'integer': return parseInt(value, 10);
      case 'json': return JSON.parse(value);
      default: return value;
    }
  }
}

const maxUpload = await Setting.query().where('key', 'max_upload_size').first();
console.log(maxUpload.typed_value); // 10485760 (number)
```

### 3. Role-Based Access Control

```typescript
class Permission extends Eloquent {
  protected static rows = [
    { id: 1, name: 'users.view', label: 'View Users', group: 'users' },
    { id: 2, name: 'users.create', label: 'Create Users', group: 'users' },
    { id: 3, name: 'users.edit', label: 'Edit Users', group: 'users' },
    { id: 4, name: 'users.delete', label: 'Delete Users', group: 'users' },
    { id: 5, name: 'posts.view', label: 'View Posts', group: 'posts' },
    { id: 6, name: 'posts.create', label: 'Create Posts', group: 'posts' },
  ];
}

// Get all user-related permissions
const userPerms = await Permission.query()
  .where('group', 'users')
  .orderBy('name')
  .get();
```

### 4. External API Integration

```typescript
class GitHubRepo extends Eloquent {
  static async getRows(): Promise<Record<string, any>[]> {
    const response = await fetch('https://api.github.com/users/octocat/repos');
    return response.json();
  }
}

// Query GitHub repos like a database
const popularRepos = await GitHubRepo.query()
  .where('stargazers_count', '>', 100)
  .orderBy('stargazers_count', 'desc')
  .limit(10)
  .get();
```

### 5. Currency/Country Codes

```typescript
class Currency extends Eloquent {
  protected static rows = [
    { code: 'USD', name: 'US Dollar', symbol: '$', decimal_places: 2 },
    { code: 'EUR', name: 'Euro', symbol: '€', decimal_places: 2 },
    { code: 'GBP', name: 'British Pound', symbol: '£', decimal_places: 2 },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimal_places: 0 },
    { code: 'BTC', name: 'Bitcoin', symbol: '₿', decimal_places: 8 },
  ];

  formatAmount(amount: number): string {
    const symbol = (this as any).symbol;
    const decimals = (this as any).decimal_places;
    return `${symbol}${amount.toFixed(decimals)}`;
  }
}

const usd = await Currency.query().where('code', 'USD').first();
console.log(usd.formatAmount(1234.5)); // "$1234.50"
```

## API Reference

### Static Properties

| Property | Type | Description |
|----------|------|-------------|
| `rows` | `Record<string, any>[]` | Static array of data (optional if `getRows()` is overridden) |

### Static Methods

| Method | Return Type | Description |
|--------|-------------|-------------|
| `usesSushi()` | `boolean` | Returns `true` if model uses Sushi (has `rows` or custom `getRows()`) |
| `getRows()` | `Promise<Record<string, any>[]>` | Returns the data rows (override for async data sources) |

### Detection

```typescript
// Check if a model uses Sushi
if (Country.usesSushi()) {
  console.log('Country uses in-memory data');
}

// Regular models return false
class User extends Eloquent {
  protected static table = 'users';
}
User.usesSushi(); // false
```

## Important Notes

1. **No Database Required**: Sushi models don't need a database connection. Perfect for standalone utilities or when you want to query static data.

2. **All Queries Are In-Memory**: Filtering, sorting, and aggregation happen in JavaScript, not SQL. This is efficient for small to medium datasets but may not be suitable for very large datasets.

3. **Async by Default**: The `getRows()` method is async, allowing you to fetch data from APIs or other async sources.

4. **Full Query Builder Support**: Most QueryBuilder methods work with Sushi, including `where`, `orderBy`, `limit`, `count`, `first`, etc.

5. **Accessors Work**: Define `getXxxAttribute()` methods and they'll work just like with database models.

6. **Type Safety**: Sushi models work with TypeScript and maintain type safety for your data.
