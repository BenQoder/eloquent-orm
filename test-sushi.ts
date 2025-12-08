import { Eloquent } from './src';

// ============================================
// Sushi Models (in-memory array data)
// ============================================

class Country extends Eloquent {
  protected static table = 'countries';

  // Sushi data - no database needed!
  protected static rows = [
    { id: 1, code: 'US', name: 'United States', continent: 'North America', population: 331000000 },
    { id: 2, code: 'CA', name: 'Canada', continent: 'North America', population: 38000000 },
    { id: 3, code: 'MX', name: 'Mexico', continent: 'North America', population: 128000000 },
    { id: 4, code: 'GB', name: 'United Kingdom', continent: 'Europe', population: 67000000 },
    { id: 5, code: 'DE', name: 'Germany', continent: 'Europe', population: 83000000 },
    { id: 6, code: 'FR', name: 'France', continent: 'Europe', population: 67000000 },
    { id: 7, code: 'JP', name: 'Japan', continent: 'Asia', population: 126000000 },
    { id: 8, code: 'CN', name: 'China', continent: 'Asia', population: 1400000000 },
    { id: 9, code: 'IN', name: 'India', continent: 'Asia', population: 1380000000 },
    { id: 10, code: 'NG', name: 'Nigeria', continent: 'Africa', population: 206000000 },
  ];

  // Accessor
  getFormattedPopulationAttribute(): string {
    const pop = (this as any).population;
    return pop >= 1000000000
      ? `${(pop / 1000000000).toFixed(1)}B`
      : `${(pop / 1000000).toFixed(0)}M`;
  }
}

class State extends Eloquent {
  protected static table = 'states';

  // Sushi data for US states
  protected static rows = [
    { id: 1, country_id: 1, code: 'CA', name: 'California', capital: 'Sacramento' },
    { id: 2, country_id: 1, code: 'TX', name: 'Texas', capital: 'Austin' },
    { id: 3, country_id: 1, code: 'NY', name: 'New York', capital: 'Albany' },
    { id: 4, country_id: 1, code: 'FL', name: 'Florida', capital: 'Tallahassee' },
    { id: 5, country_id: 2, code: 'ON', name: 'Ontario', capital: 'Toronto' },
    { id: 6, country_id: 2, code: 'QC', name: 'Quebec', capital: 'Quebec City' },
  ];

  country() {
    return this.belongsTo(Country, 'country_id');
  }
}

class Role extends Eloquent {
  protected static table = 'roles';

  // Sushi data for roles
  protected static rows = [
    { id: 1, name: 'admin', label: 'Administrator', level: 100 },
    { id: 2, name: 'editor', label: 'Editor', level: 50 },
    { id: 3, name: 'author', label: 'Author', level: 30 },
    { id: 4, name: 'subscriber', label: 'Subscriber', level: 10 },
    { id: 5, name: 'guest', label: 'Guest', level: 0 },
  ];

  // Accessor
  getIsAdminAttribute(): boolean {
    return (this as any).name === 'admin';
  }
}

class Setting extends Eloquent {
  protected static table = 'settings';

  // Sushi data for app settings
  protected static rows = [
    { id: 1, key: 'app_name', value: 'My App', type: 'string' },
    { id: 2, key: 'app_debug', value: 'true', type: 'boolean' },
    { id: 3, key: 'app_timezone', value: 'UTC', type: 'string' },
    { id: 4, key: 'mail_driver', value: 'smtp', type: 'string' },
    { id: 5, key: 'cache_ttl', value: '3600', type: 'integer' },
  ];
}

// ============================================
// Test Helpers
// ============================================

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log('  [PASS]', message);
    passed++;
  } else {
    console.log('  [FAIL]', message);
    failed++;
  }
}

function assertEquals(actual: any, expected: any, message: string) {
  const isEqual = JSON.stringify(actual) === JSON.stringify(expected);
  if (isEqual) {
    console.log('  [PASS]', message);
    passed++;
  } else {
    console.log('  [FAIL]', message);
    console.log('         Expected:', expected);
    console.log('         Actual:', actual);
    failed++;
  }
}

// ============================================
// Tests
// ============================================

async function testSushiBasicQuery() {
  console.log('\n--- TEST: Sushi Basic Query ---');

  // Get all countries
  const countries = await Country.query().get();
  assertEquals(countries.length, 10, 'Get all countries returns 10 rows');

  // Get all roles
  const roles = await Role.query().get();
  assertEquals(roles.length, 5, 'Get all roles returns 5 rows');

  // Get all settings
  const settings = await Setting.query().get();
  assertEquals(settings.length, 5, 'Get all settings returns 5 rows');
}

async function testSushiWhere() {
  console.log('\n--- TEST: Sushi where() ---');

  // Where equals
  const us = await Country.query().where('code', 'US').first() as any;
  assertEquals(us.name, 'United States', 'where("code", "US") returns United States');

  // Where with operator
  const largeCountries = await Country.query().where('population', '>', 200000000).get();
  assertEquals(largeCountries.length, 4, 'where("population", ">", 200M) returns 4 countries');

  // Where less than
  const smallCountries = await Country.query().where('population', '<', 50000000).get();
  assertEquals(smallCountries.length, 1, 'where("population", "<", 50M) returns 1 country (Canada)');
  assertEquals((smallCountries[0] as any).name, 'Canada', 'Small country is Canada');

  // Where not equals
  const notUS = await Country.query().where('code', '!=', 'US').get();
  assertEquals(notUS.length, 9, 'where("code", "!=", "US") returns 9 countries');
}

async function testSushiWhereIn() {
  console.log('\n--- TEST: Sushi whereIn() ---');

  const selected = await Country.query().whereIn('code', ['US', 'CA', 'MX']).get();
  assertEquals(selected.length, 3, 'whereIn returns 3 North American countries');

  const names = selected.map((c: any) => c.name).sort();
  assertEquals(names, ['Canada', 'Mexico', 'United States'], 'Correct countries returned');
}

async function testSushiWhereNotIn() {
  console.log('\n--- TEST: Sushi whereNotIn() ---');

  const notNA = await Country.query().whereNotIn('continent', ['North America']).get();
  assertEquals(notNA.length, 7, 'whereNotIn returns 7 non-North American countries');
}

async function testSushiOrderBy() {
  console.log('\n--- TEST: Sushi orderBy() ---');

  // Order by name asc
  const byName = await Country.query().orderBy('name', 'asc').get();
  assertEquals((byName[0] as any).name, 'Canada', 'First country alphabetically is Canada');
  assertEquals((byName[9] as any).name, 'United States', 'Last country alphabetically is United States');

  // Order by population desc
  const byPop = await Country.query().orderBy('population', 'desc').get();
  assertEquals((byPop[0] as any).name, 'China', 'Most populous is China');
  assertEquals((byPop[1] as any).name, 'India', 'Second most populous is India');

  // Multiple orderBy
  const byContinent = await Country.query()
    .orderBy('continent', 'asc')
    .orderBy('name', 'asc')
    .get();
  assertEquals((byContinent[0] as any).name, 'Nigeria', 'First by continent+name is Nigeria (Africa)');
}

async function testSushiLimitOffset() {
  console.log('\n--- TEST: Sushi limit() and offset() ---');

  // Limit
  const first3 = await Country.query().limit(3).get();
  assertEquals(first3.length, 3, 'limit(3) returns 3 countries');

  // Offset
  const skip2 = await Country.query().offset(2).limit(2).get();
  assertEquals(skip2.length, 2, 'offset(2).limit(2) returns 2 countries');
  assertEquals((skip2[0] as any).id, 3, 'First country after offset is id=3');

  // Pagination-style
  const page2 = await Country.query().orderBy('id').offset(5).limit(5).get();
  assertEquals(page2.length, 5, 'Page 2 (offset 5, limit 5) returns 5 countries');
  assertEquals((page2[0] as any).id, 6, 'First on page 2 is id=6');
}

async function testSushiSelect() {
  console.log('\n--- TEST: Sushi select() ---');

  const partial = await Country.query().select('id', 'name').first() as any;
  assert(partial.id !== undefined, 'id is selected');
  assert(partial.name !== undefined, 'name is selected');
  // Note: Sushi select filters columns, but other columns may still exist from row data
}

async function testSushiCombinedQuery() {
  console.log('\n--- TEST: Sushi Combined Query ---');

  // Complex query: European countries ordered by population desc, limit 2
  const europeanCountries = await Country.query()
    .where('continent', 'Europe')
    .orderBy('population', 'desc')
    .limit(2)
    .get();

  assertEquals(europeanCountries.length, 2, 'Combined query returns 2 European countries');
  assertEquals((europeanCountries[0] as any).name, 'Germany', 'Most populous European is Germany');
  // France and UK have equal population (67M), so either can be second
  const secondName = (europeanCountries[1] as any).name;
  assert(secondName === 'France' || secondName === 'United Kingdom', 'Second is France or UK (same pop)');

  // Asian countries with population > 500M
  const largeAsian = await Country.query()
    .where('continent', 'Asia')
    .where('population', '>', 500000000)
    .orderBy('population', 'desc')
    .get();

  assertEquals(largeAsian.length, 2, 'Large Asian countries: 2');
  assertEquals((largeAsian[0] as any).name, 'China', 'Largest Asian is China');
  assertEquals((largeAsian[1] as any).name, 'India', 'Second largest is India');
}

async function testSushiAccessors() {
  console.log('\n--- TEST: Sushi Accessors ---');

  const china = await Country.query().where('code', 'CN').first() as any;
  assertEquals(china.formatted_population, '1.4B', 'China formatted population is 1.4B');

  const canada = await Country.query().where('code', 'CA').first() as any;
  assertEquals(canada.formatted_population, '38M', 'Canada formatted population is 38M');

  const admin = await Role.query().where('name', 'admin').first() as any;
  assertEquals(admin.is_admin, true, 'Admin role is_admin is true');

  const guest = await Role.query().where('name', 'guest').first() as any;
  assertEquals(guest.is_admin, false, 'Guest role is_admin is false');
}

async function testSushiFirst() {
  console.log('\n--- TEST: Sushi first() ---');

  const first = await Country.query().first() as any;
  assert(first !== null, 'first() returns a country');
  assertEquals(first.id, 1, 'first() returns id=1');

  const notFound = await Country.query().where('code', 'XX').first();
  assertEquals(notFound, null, 'first() returns null when not found');
}

async function testSushiCount() {
  console.log('\n--- TEST: Sushi count() ---');

  const total = await Country.query().count();
  assertEquals(total, 10, 'count() returns 10 total countries');

  const european = await Country.query().where('continent', 'Europe').count();
  assertEquals(european, 3, 'count() with where returns 3 European countries');
}

async function testSushiExists() {
  console.log('\n--- TEST: Sushi exists() ---');

  const exists = await Country.query().where('code', 'US').exists();
  assertEquals(exists, true, 'US exists');

  const notExists = await Country.query().where('code', 'XX').exists();
  assertEquals(notExists, false, 'XX does not exist');
}

async function testSushiWhereNull() {
  console.log('\n--- TEST: Sushi whereNull() / whereNotNull() ---');

  // Add a country with null capital for testing
  class CountryWithNull extends Eloquent {
    protected static rows = [
      { id: 1, name: 'Test1', capital: 'Capital1' },
      { id: 2, name: 'Test2', capital: null },
      { id: 3, name: 'Test3', capital: 'Capital3' },
    ];
  }

  const withCapital = await CountryWithNull.query().whereNotNull('capital').get();
  assertEquals(withCapital.length, 2, 'whereNotNull returns 2 with capital');

  const noCapital = await CountryWithNull.query().whereNull('capital').get();
  assertEquals(noCapital.length, 1, 'whereNull returns 1 without capital');
}

async function testSushiWhereBetween() {
  console.log('\n--- TEST: Sushi whereBetween() ---');

  const midPop = await Country.query()
    .whereBetween('population', [50000000, 150000000])
    .get();

  // Countries with pop between 50M and 150M: UK (67M), DE (83M), FR (67M), JP (126M), MX (128M)
  assertEquals(midPop.length, 5, 'whereBetween returns 5 mid-population countries');
}

async function testSushiOrWhere() {
  console.log('\n--- TEST: Sushi orWhere() ---');

  const usOrCanada = await Country.query()
    .where('code', 'US')
    .orWhere('code', 'CA')
    .get();

  assertEquals(usOrCanada.length, 2, 'orWhere returns US and Canada');
}

async function testSushiUsesSushi() {
  console.log('\n--- TEST: usesSushi() detection ---');

  assertEquals(Country.usesSushi(), true, 'Country.usesSushi() is true');
  assertEquals(Role.usesSushi(), true, 'Role.usesSushi() is true');

  // Regular model without rows should return false
  class RegularModel extends Eloquent {
    protected static table = 'regular';
  }
  assertEquals(RegularModel.usesSushi(), false, 'RegularModel.usesSushi() is false');
}

async function testSushiAsyncGetRows() {
  console.log('\n--- TEST: Sushi async getRows() (API simulation) ---');

  // Simulate an API-based Sushi model
  class ApiCountry extends Eloquent {
    protected static table = 'api_countries';

    // Override getRows to fetch from "API" (simulated)
    static async getRows(): Promise<Record<string, any>[]> {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 10));
      return [
        { id: 1, code: 'BR', name: 'Brazil', population: 212000000 },
        { id: 2, code: 'AR', name: 'Argentina', population: 45000000 },
        { id: 3, code: 'CO', name: 'Colombia', population: 50000000 },
      ];
    }
  }

  assertEquals(ApiCountry.usesSushi(), true, 'ApiCountry.usesSushi() is true');

  const countries = await ApiCountry.query().get();
  assertEquals(countries.length, 3, 'Async getRows returns 3 countries');

  const brazil = await ApiCountry.query().where('code', 'BR').first() as any;
  assertEquals(brazil.name, 'Brazil', 'Can query async Sushi model');

  const count = await ApiCountry.query().count();
  assertEquals(count, 3, 'count() works with async getRows');

  const large = await ApiCountry.query().where('population', '>', 100000000).get();
  assertEquals(large.length, 1, 'where() works with async getRows');
  assertEquals((large[0] as any).name, 'Brazil', 'Correct country filtered');
}

// ============================================
// Main
// ============================================

async function main() {
  console.log('==============================================');
  console.log('  ELOQUENT SUSHI (IN-MEMORY ARRAY) TESTS');
  console.log('==============================================');
  console.log('  No database connection required!');

  try {
    await testSushiBasicQuery();
    await testSushiWhere();
    await testSushiWhereIn();
    await testSushiWhereNotIn();
    await testSushiOrderBy();
    await testSushiLimitOffset();
    await testSushiSelect();
    await testSushiCombinedQuery();
    await testSushiAccessors();
    await testSushiFirst();
    await testSushiCount();
    await testSushiExists();
    await testSushiWhereNull();
    await testSushiWhereBetween();
    await testSushiOrWhere();
    await testSushiUsesSushi();
    await testSushiAsyncGetRows();

    console.log('\n==============================================');
    console.log('  RESULTS:', passed, 'passed,', failed, 'failed');
    console.log('==============================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('\nTEST ERROR:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
