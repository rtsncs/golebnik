import { Pool } from 'pg';

const pool = new Pool();

export const query = (text: string, params?: any[]) => pool.query(text, params);
