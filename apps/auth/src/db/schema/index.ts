import { pgTableCreator } from 'drizzle-orm/pg-core';

export const createTable = pgTableCreator((name) => `auth_${name}`);

export * from './auth'
