import * as mysql2Promise from 'mysql2/promise';

export const createConnection = mysql2Promise.createConnection;
export const createPool = mysql2Promise.createPool;
export const createPoolCluster = mysql2Promise.createPoolCluster;
export const escape = mysql2Promise.escape;
export const escapeId = mysql2Promise.escapeId;
export const format = mysql2Promise.format;
export const raw = mysql2Promise.raw;
export const Connection = mysql2Promise.Connection;
export const PoolConnection = mysql2Promise.PoolConnection;
export const PromisePool = mysql2Promise.PromisePool;
export const PromiseConnection = mysql2Promise.PromiseConnection;
export const PromisePoolConnection = mysql2Promise.PromisePoolConnection;
export const Types = mysql2Promise.Types;
export const Charsets = mysql2Promise.Charsets;
export const CharsetToEncoding = mysql2Promise.CharsetToEncoding;
export const setMaxParserCache = mysql2Promise.setMaxParserCache;
export const clearParserCache = mysql2Promise.clearParserCache;

export default mysql2Promise;
