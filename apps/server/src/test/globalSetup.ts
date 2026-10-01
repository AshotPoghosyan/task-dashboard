import { migrateTestDb } from './db.js';

export default function setup(): void {
  migrateTestDb();
}
