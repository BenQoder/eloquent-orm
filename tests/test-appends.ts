import { Eloquent } from '../src';

// ============================================
// Test Models with Appends
// ============================================

class User extends Eloquent {
  protected static table = 'users';
  protected static hidden = ['password'];
  protected static appends = ['fullName', 'isAdmin'];

  protected static rows = [
    { id: 1, first_name: 'John', last_name: 'Doe', email: 'john@example.com', password: 'secret123', role: 'admin' },
    { id: 2, first_name: 'Jane', last_name: 'Smith', email: 'jane@example.com', password: 'secret456', role: 'user' },
    { id: 3, first_name: 'Bob', last_name: null, email: 'bob@example.com', password: 'secret789', role: 'user' },
  ];

  // Accessor for fullName
  getFullNameAttribute(): string | null {
    const firstName = (this as any).first_name;
    const lastName = (this as any).last_name;
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    return firstName || null;
  }

  // Accessor for isAdmin
  getIsAdminAttribute(): boolean {
    return (this as any).role === 'admin';
  }
}

class Media extends Eloquent {
  protected static table = 'media';
  protected static appends = ['url'];

  protected static rows = [
    { id: 1, identifier: 'abc123', type: 'image' },
    { id: 2, identifier: 'def456', type: 'video' },
    { id: 3, identifier: null, type: 'image' },
  ];

  // Accessor for URL - like Cloudflare Images
  getUrlAttribute(): string | null {
    const identifier = (this as any).identifier;
    if (!identifier) return null;
    return `https://imagedelivery.net/example/${identifier}/w=800,fit=cover`;
  }
}

class NoAppends extends Eloquent {
  protected static table = 'no_appends';

  protected static rows = [
    { id: 1, name: 'Test', value: 100 },
  ];

  // This accessor exists but is NOT in appends
  getComputedValueAttribute(): number {
    return (this as any).value * 2;
  }
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

async function testAppendsIncludedInJSON() {
  console.log('\n--- TEST: Appends included in toJSON() ---');

  const john = await User.query().where('id', 1).first();
  const json = john!.toJSON();

  assertEquals(json.fullName, 'John Doe', 'fullName accessor is included in JSON');
  assertEquals(json.isAdmin, true, 'isAdmin accessor is included in JSON');
  assert(json.first_name === 'John', 'Regular properties still included');
  assert(json.email === 'john@example.com', 'Email property included');
}

async function testHiddenStillRespected() {
  console.log('\n--- TEST: Hidden properties still excluded ---');

  const user = await User.query().first();
  const json = user!.toJSON();

  assert(json.password === undefined, 'Hidden password is NOT in JSON');
  assert(json.first_name !== undefined, 'Non-hidden properties are included');
}

async function testAppendsWithNullValues() {
  console.log('\n--- TEST: Appends handles null values ---');

  // Bob has null last_name
  const bob = await User.query().where('id', 3).first();
  const json = bob!.toJSON();

  assertEquals(json.fullName, 'Bob', 'fullName with null last_name returns first name only');
  assertEquals(json.isAdmin, false, 'isAdmin is false for non-admin');
}

async function testMediaUrlAppends() {
  console.log('\n--- TEST: Media URL accessor appends ---');

  const media1 = await Media.query().where('id', 1).first();
  const json1 = media1!.toJSON();

  assertEquals(
    json1.url,
    'https://imagedelivery.net/example/abc123/w=800,fit=cover',
    'URL is generated from identifier'
  );

  // Test null identifier
  const media3 = await Media.query().where('id', 3).first();
  const json3 = media3!.toJSON();

  assertEquals(json3.url, null, 'URL is null when identifier is null');
}

async function testNoAppendsModel() {
  console.log('\n--- TEST: Model without appends ---');

  const item = await NoAppends.query().first();
  const json = item!.toJSON();

  assert(json.computedValue === undefined, 'Accessor not in appends is NOT included in JSON');
  assert(json.name === 'Test', 'Regular properties are included');
  assert(json.value === 100, 'Value property included');

  // But accessor still works when accessed directly
  assertEquals((item as any).computed_value, 200, 'Accessor works when accessed directly');
}

async function testAppendsOnArray() {
  console.log('\n--- TEST: Appends on array of models ---');

  const users = await User.query().get();
  const jsonArray = users.map(u => u.toJSON());

  assertEquals(jsonArray.length, 3, 'All 3 users returned');
  assertEquals(jsonArray[0].fullName, 'John Doe', 'First user has fullName');
  assertEquals(jsonArray[1].fullName, 'Jane Smith', 'Second user has fullName');
  assertEquals(jsonArray[0].isAdmin, true, 'John is admin');
  assertEquals(jsonArray[1].isAdmin, false, 'Jane is not admin');
}

async function testJSONStringify() {
  console.log('\n--- TEST: JSON.stringify includes appends ---');

  const user = await User.query().where('id', 1).first();
  const jsonString = JSON.stringify(user);
  const parsed = JSON.parse(jsonString);

  assertEquals(parsed.fullName, 'John Doe', 'fullName in stringified JSON');
  assertEquals(parsed.isAdmin, true, 'isAdmin in stringified JSON');
  assert(parsed.password === undefined, 'password NOT in stringified JSON');
}

// ============================================
// Main
// ============================================

async function main() {
  console.log('==============================================');
  console.log('  ELOQUENT APPENDS FEATURE TESTS');
  console.log('==============================================');

  try {
    await testAppendsIncludedInJSON();
    await testHiddenStillRespected();
    await testAppendsWithNullValues();
    await testMediaUrlAppends();
    await testNoAppendsModel();
    await testAppendsOnArray();
    await testJSONStringify();

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
